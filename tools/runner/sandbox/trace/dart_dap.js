#!/usr/bin/env node
"use strict";
/**
 * Dart Debug Adapter Protocol (DAP) 服务端：
 * 基于 Dart VM Service Protocol（dart --enable-vm-service=0 --pause-isolates-on-start）与 Node 内置 WebSocket 实现，零 pub 依赖。
 * 用法：node dart_dap.js <userFullPath> <off> <n> <stdinFile> <dillOrScriptPath> [scriptArgs...]
 */
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const USER_FULL = fs.realpathSync(path.resolve(process.argv[2]));
const USER_BASE = path.basename(USER_FULL);
const OFF = Number(process.argv[3]);
const N = Number(process.argv[4]);
const STDIN_FILE = process.argv[5] || "";
const TARGET_PATH = path.resolve(process.argv[6]);
const TARGET_ARGS = process.argv.slice(7);

let outSeq = 1;
function sendMsg(obj) {
  if (!obj.seq) obj.seq = outSeq++;
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const hdr = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii");
  process.stdout.write(Buffer.concat([hdr, body]));
}
function sendResponse(req, success = true, body = {}, message) {
  const r = { seq: outSeq++, type: "response", request_seq: req.seq, success, command: req.command };
  if (body !== undefined) r.body = body;
  if (!success && message) r.message = message;
  sendMsg(r);
}
function sendEvent(event, body = {}) {
  sendMsg({ seq: outSeq++, type: "event", event, body });
}

class DapFrameReader {
  constructor(onMsg) {
    this.buf = Buffer.alloc(0);
    this.onMsg = onMsg;
  }
  push(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const sep = this.buf.indexOf("\r\n\r\n");
      if (sep < 0) return;
      const hdr = this.buf.slice(0, sep).toString("ascii");
      const m = hdr.match(/Content-Length:\s*(\d+)/i);
      if (!m) { this.buf = this.buf.slice(sep + 4); continue; }
      const len = Number(m[1]);
      if (this.buf.length < sep + 4 + len) return;
      const raw = this.buf.slice(sep + 4, sep + 4 + len).toString("utf8");
      this.buf = this.buf.slice(sep + 4 + len);
      try { this.onMsg(JSON.parse(raw)); } catch {}
    }
  }
}

class DartVmDap {
  constructor() {
    this.child = null;
    this.ws = null;
    this.rpcId = 1;
    this.pending = new Map();
    this.isolateId = null;
    this.userScriptId = null;
    this.scriptLines = new Map(); // scriptId -> Map<tokenPos, line>
    this.wantedLines = [];
    this.bpIds = [];
    this.launched = false;
    this.configDone = false;
    this.startedRun = false;
    this.paused = false;
    this.frames = [];
    this.frameMap = new Map();
    this.varMap = new Map();
    this.nextRef = 100;
    this.exited = false;
    this.readyPromise = null;
  }

  async ensureStarted() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      const env = { ...process.env, DART_SUPPRESS_ANALYTICS: "true" };
      this.serviceInfoPath = path.join(path.dirname(TARGET_PATH), `.dart-vm-${process.pid}.json`);
      try { fs.rmSync(this.serviceInfoPath, { force: true }); } catch {}
      const args = [
        "run",
        "--no-dds",
        "--enable-vm-service=0",
        "--pause-isolates-on-start",
        "--pause-isolates-on-exit",
        "--disable-service-auth-codes",
        `--write-service-info=${this.serviceInfoPath}`,
        TARGET_PATH,
        ...TARGET_ARGS,
      ];
      this.child = cp.spawn("dart", args, { cwd: path.dirname(TARGET_PATH), env, stdio: ["pipe", "pipe", "pipe"] });
      if (STDIN_FILE && fs.existsSync(STDIN_FILE)) {
        fs.createReadStream(STDIN_FILE).pipe(this.child.stdin);
      } else {
        this.child.stdin.end();
      }

      const wsUrl = await new Promise((resolve, reject) => {
        let earlyExit = false;
        let errBuf = "";
        this.child.stderr.on("data", (d) => { errBuf = (errBuf + d).slice(-2000); });
        this.child.once("exit", () => { earlyExit = true; });
        const deadline = Date.now() + 15000;
        const poll = () => {
          if (fs.existsSync(this.serviceInfoPath)) {
            try {
              const info = JSON.parse(fs.readFileSync(this.serviceInfoPath, "utf8"));
              if (info && info.uri) {
                const u = String(info.uri).replace(/^http:/, "ws:");
                resolve(u.endsWith("/") ? u + "ws" : u + "/ws");
                return;
              }
            } catch {}
          }
          if (earlyExit) return reject(new Error("Dart 进程提前退出：" + errBuf));
          if (Date.now() > deadline) return reject(new Error("Dart VM Service 启动超时：" + errBuf));
          setTimeout(poll, 40);
        };
        poll();
      });

      this.child.on("close", (code) => {
        if (this.exited) return;
        this.exited = true;
        sendEvent("exited", { exitCode: typeof code === "number" ? code : 0 });
        sendEvent("terminated", {});
        setTimeout(() => process.exit(0), 30);
      });

      await new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;
        ws.addEventListener("open", () => resolve());
        ws.addEventListener("error", (e) => reject(new Error("Dart VM WebSocket 错误：" + String(e && e.message || e))));
        ws.addEventListener("message", (ev) => this.onRpcMessage(String(ev.data)));
      });

      await this.rpc("streamListen", { streamId: "Debug" });
      await this.rpc("streamListen", { streamId: "Stdout" });
      await this.rpc("streamListen", { streamId: "Stderr" });

      const vm = await this.rpc("getVM");
      this.isolateId = (vm.isolates && vm.isolates[0] && vm.isolates[0].id) || null;
      if (this.isolateId) {
        // Wait briefly for main isolate to finish loading scripts & reach PauseStart
        for (let i = 0; i < 40; i++) {
          const iso = await this.rpc("getIsolate", { isolateId: this.isolateId }).catch(() => null);
          if (iso && iso.pauseEvent && iso.pauseEvent.kind === "PauseStart") break;
          await new Promise((r) => setTimeout(r, 50));
        }
        const scripts = await this.rpc("getScripts", { isolateId: this.isolateId });
        for (const sc of scripts.scripts || []) {
          if (sc.uri && (sc.uri.endsWith("/" + USER_BASE) || sc.uri === "file://" + USER_FULL)) {
            this.userScriptId = sc.id;
            break;
          }
        }
      }
    })();
    return this.readyPromise;
  }

  rpc(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) return reject(new Error("VM Service 未连接"));
      const id = String(this.rpcId++);
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  onRpcMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.id !== undefined) {
      const p = this.pending.get(String(msg.id));
      if (p) {
        this.pending.delete(String(msg.id));
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else p.resolve(msg.result || {});
      }
      return;
    }
    if (msg.method === "streamNotify" && msg.params) {
      const { streamId, event } = msg.params;
      if (!event) return;
      if (streamId === "Stdout" || streamId === "Stderr") {
        if (event.kind === "WriteEvent" && event.bytes) {
          const text = Buffer.from(event.bytes, "base64").toString("utf8");
          if (text) sendEvent("output", { category: streamId === "Stderr" ? "stderr" : "stdout", output: text });
        }
        return;
      }
      if (streamId === "Debug") {
        this.onDebugEvent(event).catch(() => {});
      }
    }
  }

  async resolveLine(scriptId, tokenPos) {
    if (!scriptId || tokenPos == null) return 0;
    let map = this.scriptLines.get(scriptId);
    if (!map) {
      map = new Map();
      try {
        const sc = await this.rpc("getObject", { isolateId: this.isolateId, objectId: scriptId });
        for (const row of sc.tokenPosTable || []) {
          const line = row[0];
          for (let i = 1; i < row.length; i += 2) map.set(row[i], line);
        }
      } catch {}
      this.scriptLines.set(scriptId, map);
    }
    return map.get(tokenPos) || 0;
  }

  async onDebugEvent(ev) {
    if (!this.isolateId && ev.isolate) this.isolateId = ev.isolate.id;
    if (ev.kind === "PauseExit") {
      await this.rpc("resume", { isolateId: this.isolateId }).catch(() => {});
      if (!this.exited) {
        this.exited = true;
        sendEvent("exited", { exitCode: 0 });
        sendEvent("terminated", {});
        this.kill();
        setTimeout(() => process.exit(0), 30);
      }
      return;
    }
    if (ev.kind === "PauseStart") {
      if (this.startedRun) await this.rpc("resume", { isolateId: this.isolateId }).catch(() => {});
      return;
    }
    if (ev.kind === "PauseBreakpoint" || ev.kind === "PauseInterrupted") {
      const stack = await this.rpc("getStack", { isolateId: this.isolateId });
      const userFrames = [];
      for (const f of stack.frames || []) {
        const loc = f.location;
        if (!loc || !loc.script) continue;
        const uri = String(loc.script.uri || "");
        if (loc.script.id !== this.userScriptId && !uri.endsWith("/" + USER_BASE)) continue;
        const line = await this.resolveLine(loc.script.id, loc.tokenPos);
        if (line > OFF && line <= OFF + N) {
          userFrames.push({ frame: f, line, name: (f.function && f.function.name) || "main" });
        }
      }
      if (!userFrames.length) {
        await this.rpc("resume", { isolateId: this.isolateId }).catch(() => {});
        return;
      }
      this.paused = true;
      this.frames = userFrames;
      this.frameMap.clear();
      this.varMap.clear();
      const reason = ev.kind === "PauseBreakpoint" && !ev.atAsyncSuspension ? "breakpoint" : "step";
      sendEvent("stopped", { reason, threadId: 1, allThreadsStopped: true });
    }
  }

  async syncBreakpoints(lines) {
    this.wantedLines = lines.slice();
    await this.ensureStarted();
    if (!this.isolateId || !this.userScriptId) return;
    for (const id of this.bpIds) {
      await this.rpc("removeBreakpoint", { isolateId: this.isolateId, breakpointId: id }).catch(() => {});
    }
    this.bpIds = [];
    for (const ln of this.wantedLines) {
      if (ln <= OFF || ln > OFF + N) continue;
      try {
        const bp = await this.rpc("addBreakpoint", { isolateId: this.isolateId, scriptId: this.userScriptId, line: ln });
        if (bp && bp.id) this.bpIds.push(bp.id);
      } catch {}
    }
  }

  async maybeRun() {
    if (this.startedRun || !this.launched || !this.configDone) return;
    this.startedRun = true;
    await this.ensureStarted();
    if (this.isolateId) await this.rpc("resume", { isolateId: this.isolateId }).catch(() => {});
  }

  formatInst(val) {
    if (!val) return { value: "null", type: "Null", variablesReference: 0 };
    if (val.valueAsString !== undefined) {
      const str = val.kind === "String" ? JSON.stringify(val.valueAsString) : String(val.valueAsString);
      return { value: str, type: (val.class && val.class.name) || val.kind || "dynamic", variablesReference: 0 };
    }
    const cls = (val.class && val.class.name) || val.kind || "Object";
    const vref = val.id ? (++this.nextRef, this.varMap.set(this.nextRef, val.id), this.nextRef) : 0;
    const len = typeof val.length === "number" ? ` (len=${val.length})` : "";
    return { value: cls + len, type: cls, variablesReference: vref };
  }

  kill() {
    this.exited = true;
    try { if (this.ws) this.ws.close(); } catch {}
    if (this.child && !this.child.killed) {
      try { this.child.kill("SIGKILL"); } catch {}
    }
  }
}

const dbg = new DartVmDap();

async function handleRequest(req) {
  const cmd = req.command;
  const args = req.arguments || {};
  try {
    if (cmd === "initialize") {
      sendResponse(req, true, {
        supportsConfigurationDoneRequest: true,
        supportsEvaluateForHovers: true,
        supportsTerminateRequest: true,
      });
      await dbg.ensureStarted();
      sendEvent("initialized", {});
      return;
    }
    if (cmd === "launch") {
      dbg.launched = true;
      sendResponse(req, true, {});
      await dbg.maybeRun();
      return;
    }
    if (cmd === "setBreakpoints") {
      const bps = Array.isArray(args.breakpoints) ? args.breakpoints : [];
      const lines = bps.map((b) => Number(b.line)).filter((n) => Number.isFinite(n) && n > 0);
      await dbg.syncBreakpoints(lines);
      sendResponse(req, true, {
        breakpoints: lines.map((line) => ({ verified: line > OFF && line <= OFF + N, line })),
      });
      return;
    }
    if (cmd === "configurationDone") {
      dbg.configDone = true;
      sendResponse(req, true, {});
      await dbg.maybeRun();
      return;
    }
    if (cmd === "threads") {
      sendResponse(req, true, { threads: [{ id: 1, name: "main" }] });
      return;
    }
    if (cmd === "stackTrace") {
      const stackFrames = dbg.frames.map((item) => {
        const fid = ++dbg.nextRef;
        dbg.frameMap.set(fid, item.frame);
        return {
          id: fid,
          name: item.name,
          line: item.line,
          column: 1,
          source: { name: USER_BASE, path: USER_FULL },
        };
      });
      sendResponse(req, true, { stackFrames, totalFrames: stackFrames.length });
      return;
    }
    if (cmd === "scopes") {
      const fid = Number(args.frameId);
      const frame = dbg.frameMap.get(fid) || (dbg.frames[0] && dbg.frames[0].frame);
      if (!frame) { sendResponse(req, true, { scopes: [] }); return; }
      const lref = ++dbg.nextRef;
      dbg.varMap.set(lref, { frameVars: frame.vars || [] });
      sendResponse(req, true, { scopes: [{ name: "Locals", variablesReference: lref, expensive: false }] });
      return;
    }
    if (cmd === "variables") {
      const ref = dbg.varMap.get(Number(args.variablesReference));
      if (!ref) { sendResponse(req, true, { variables: [] }); return; }
      if (ref.frameVars) {
        const variables = ref.frameVars.map((v) => ({ name: v.name, ...dbg.formatInst(v.value) }));
        sendResponse(req, true, { variables });
        return;
      }
      const obj = await dbg.rpc("getObject", { isolateId: dbg.isolateId, objectId: ref, count: 50 });
      const variables = [];
      if (Array.isArray(obj.elements)) {
        obj.elements.slice(0, 50).forEach((el, i) => variables.push({ name: `[${i}]`, ...dbg.formatInst(el) }));
      } else if (Array.isArray(obj.associations)) {
        obj.associations.slice(0, 50).forEach((kv, i) => {
          const k = kv.key && kv.key.valueAsString !== undefined ? kv.key.valueAsString : `#${i}`;
          variables.push({ name: String(k), ...dbg.formatInst(kv.value) });
        });
      } else if (Array.isArray(obj.fields)) {
        for (const fl of obj.fields) {
          variables.push({ name: (fl.decl && fl.decl.name) || "field", ...dbg.formatInst(fl.value) });
        }
      }
      sendResponse(req, true, { variables });
      return;
    }
    if (cmd === "evaluate") {
      const frame = dbg.frameMap.get(Number(args.frameId)) || (dbg.frames[0] && dbg.frames[0].frame);
      if (!frame || !dbg.isolateId) { sendResponse(req, true, { result: "<未暂停>", variablesReference: 0 }); return; }
      const res = await dbg.rpc("evaluateInFrame", {
        isolateId: dbg.isolateId,
        frameIndex: frame.index || 0,
        expression: String(args.expression || ""),
      });
      if (res.type === "@Error" || res.type === "Error") {
        sendResponse(req, false, undefined, (res.message || "求值失败").split("\n")[0]);
        return;
      }
      const fmt = dbg.formatInst(res);
      sendResponse(req, true, { result: fmt.value, type: fmt.type, variablesReference: fmt.variablesReference });
      return;
    }
    if (cmd === "continue" || cmd === "next" || cmd === "stepIn" || cmd === "stepOut") {
      dbg.paused = false;
      const stepMap = { next: "Over", stepIn: "Into", stepOut: "Out" };
      const params = { isolateId: dbg.isolateId };
      if (stepMap[cmd]) params.step = stepMap[cmd];
      await dbg.rpc("resume", params);
      sendResponse(req, true, cmd === "continue" ? { allThreadsContinued: true } : {});
      return;
    }
    if (cmd === "disconnect" || cmd === "terminate") {
      sendResponse(req, true, {});
      dbg.kill();
      process.exit(0);
    }
    sendResponse(req, true, {});
  } catch (e) {
    sendResponse(req, false, undefined, String((e && e.message) || e));
  }
}

let reqChain = Promise.resolve();
const reader = new DapFrameReader((msg) => {
  reqChain = reqChain.then(() => handleRequest(msg));
});
process.stdin.on("data", (c) => reader.push(c));
process.stdin.on("end", () => { dbg.kill(); process.exit(0); });
