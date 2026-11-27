#!/usr/bin/env node
"use strict";
/**
 * JavaScript / TypeScript Debug Adapter Protocol (DAP) 服务端：
 * 基于 Node.js 原生 V8 Inspector（--inspect-brk=127.0.0.1:0）与内置 WebSocket 实现，零第三方 npm 依赖。
 * 用法：node node_dap.js <lang> <userFullPath> <off> <n> <stdinFile> <scriptPath> [scriptArgs...]
 */
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { TS_FLAGS, NODE_FLAGS } = require("../toolchain");

const LANG = process.argv[2];
const USER_FULL = fs.realpathSync(path.resolve(process.argv[3]));
const USER_BASE = path.basename(USER_FULL);
const USER_URL = pathToFileURL(USER_FULL).href;
const OFF = Number(process.argv[4]);
const N = Number(process.argv[5]);
const STDIN_FILE = process.argv[6] || "";
const SCRIPT_PATH = path.resolve(process.argv[7]);
const SCRIPT_ARGS = process.argv.slice(8);

let outSeq = 1;
function sendMsg(obj) {
  if (!obj.seq) obj.seq = outSeq++;
  const json = JSON.stringify(obj);
  const body = Buffer.from(json, "utf8");
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

const INSPECTOR_NOISE = /^(Debugger listening on ws:\/\/|For help, see: https:\/\/nodejs\.org|Debugger attached\.|Waiting for the debugger to disconnect)/;

class InspectorClient {
  constructor() {
    this.child = null;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.readyPromise = null;
    this.userScriptIds = new Set();
    this.userUrls = new Set([USER_URL, USER_FULL]);
    this.wantedLines = [];
    this.bpIds = [];
    this.callFrames = [];
    this.frameMap = new Map();
    this.objectMap = new Map();
    this.nextRef = 1000;
    this.paused = false;
    this.launched = false;
    this.configDone = false;
    this.startedRun = false;
    this.stopOnEntry = false;
    this.isStepping = false;
    this.initialPauseSeen = false;
    this.pendingInitialParams = null;
    this.exited = false;
  }

  async ensureStarted() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      const args = [
        "--inspect-brk=127.0.0.1:0",
        ...NODE_FLAGS,
        ...(LANG === "typescript" ? TS_FLAGS : []),
        SCRIPT_PATH,
        ...SCRIPT_ARGS,
      ];
      this.child = cp.spawn(process.execPath, args, {
        cwd: path.dirname(SCRIPT_PATH),
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (STDIN_FILE && fs.existsSync(STDIN_FILE)) {
        fs.createReadStream(STDIN_FILE).pipe(this.child.stdin);
      } else {
        this.child.stdin.end();
      }
      this.child.stdout.on("data", (d) => {
        sendEvent("output", { category: "stdout", output: d.toString("utf8") });
      });

      const wsUrl = await new Promise((resolve, reject) => {
        let errTail = "";
        let resolved = false;
        const timer = setTimeout(() => reject(new Error("Node Inspector 启动超时：" + errTail)), 15000);
        this.child.stderr.on("data", (d) => {
          const text = d.toString("utf8");
          if (!resolved) {
            errTail += text;
            const m = errTail.match(/ws:\/\/127\.0\.0\.1:\d+\/[^\s\r\n]+/);
            if (m) {
              resolved = true;
              clearTimeout(timer);
              resolve(m[0]);
            }
          }
          const clean = text
            .split(/\r?\n/)
            .filter((l) => !INSPECTOR_NOISE.test(l))
            .join("\n");
          if (clean.trim()) sendEvent("output", { category: "stderr", output: clean });
          if (/Waiting for the debugger to disconnect/.test(text) && this.ws) {
            try { this.ws.close(); } catch {}
          }
        });
        this.child.once("exit", (code) => {
          clearTimeout(timer);
          if (!resolved) reject(new Error("Node 进程提前退出：" + errTail));
        });
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
        ws.addEventListener("error", (e) => reject(new Error("Inspector WebSocket 错误：" + String(e && e.message || e))));
        ws.addEventListener("message", (ev) => this.onInspectorMessage(String(ev.data)));
      });

      await this.cdp("Debugger.enable", {});
      await this.cdp("Runtime.enable", {});
      await this.cdp("Debugger.setBlackboxPatterns", { patterns: ["^node:", "node:internal"] }).catch(() => {});
    })();
    return this.readyPromise;
  }

  cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) return reject(new Error("Inspector 未连接"));
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  onInspectorMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.id) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else p.resolve(msg.result || {});
      }
      return;
    }
    if (msg.method === "Debugger.scriptParsed") {
      const p = msg.params || {};
      const url = String(p.url || "");
      const matchesUser = url === USER_URL || url === USER_FULL || url.endsWith("/" + USER_BASE) || url.endsWith("\\" + USER_BASE);
      if (matchesUser && p.scriptId) {
        this.userScriptIds.add(p.scriptId);
        if (url) this.userUrls.add(url);
      }
      return;
    }
    if (msg.method === "Debugger.paused") {
      this.onPaused(msg.params || {}).catch(() => {});
    }
  }

  isUserFrame(cf) {
    if (!cf || !cf.location) return false;
    const line1 = Number(cf.location.lineNumber) + 1;
    if (line1 <= OFF || line1 > OFF + N) return false;
    if (this.userScriptIds.has(cf.location.scriptId)) return true;
    return cf.url && (this.userUrls.has(cf.url) || cf.url.endsWith("/" + USER_BASE));
  }

  async onPaused(params) {
    const frames = params.callFrames || [];
    const top = frames[0];
    const inUser = this.isUserFrame(top);
    const hitBp = Array.isArray(params.hitBreakpoints) && params.hitBreakpoints.length > 0;
    const line1 = top && top.location ? Number(top.location.lineNumber) + 1 : 0;

    if (!this.initialPauseSeen) {
      this.initialPauseSeen = true;
      // Wait until both launch & configurationDone have run before handling initial break
      if (!this.startedRun) {
        this.pendingInitialParams = params;
        return;
      }
      if (!(inUser && (this.stopOnEntry || hitBp || this.wantedLines.includes(line1)))) {
        await this.cdp("Debugger.resume").catch(() => {});
        return;
      }
    } else if (!inUser) {
      if (this.isStepping) {
        // Check if any ancestor frame is in user code (stepped into prelude/stdlib helper)
        const hasUserCaller = frames.slice(1).some((f) => this.isUserFrame(f));
        if (hasUserCaller && top && !this.userScriptIds.has(top.location.scriptId)) {
          await this.cdp("Debugger.stepOut").catch(() => {});
          return;
        }
        this.isStepping = false;
      }
      await this.cdp("Debugger.resume").catch(() => {});
      return;
    }

    this.paused = true;
    this.isStepping = false;
    this.callFrames = frames.filter((f) => this.isUserFrame(f));
    this.frameMap.clear();
    this.objectMap.clear();
    const reason = hitBp ? "breakpoint" : (params.reason === "Break on start" ? "entry" : "step");
    sendEvent("stopped", { reason, threadId: 1, allThreadsStopped: true });
  }

  async syncBreakpoints(lines) {
    this.wantedLines = lines.slice();
    await this.ensureStarted();
    for (const id of this.bpIds) {
      await this.cdp("Debugger.removeBreakpoint", { breakpointId: id }).catch(() => {});
    }
    this.bpIds = [];
    for (const ln of this.wantedLines) {
      if (ln <= OFF || ln > OFF + N) continue;
      for (const url of this.userUrls) {
        try {
          const res = await this.cdp("Debugger.setBreakpointByUrl", { lineNumber: ln - 1, url });
          if (res && res.breakpointId) this.bpIds.push(res.breakpointId);
          if (res && res.breakpointId) break;
        } catch {}
      }
    }
  }

  async maybeRun() {
    if (this.startedRun || !this.launched || !this.configDone) return;
    this.startedRun = true;
    await this.ensureStarted();
    await this.cdp("Runtime.runIfWaitingForDebugger").catch(() => {});
    if (this.pendingInitialParams) {
      const p = this.pendingInitialParams;
      this.pendingInitialParams = null;
      this.initialPauseSeen = false;
      await this.onPaused(p).catch(() => {});
    }
  }

  allocObj(objectId) {
    if (!objectId) return 0;
    const ref = ++this.nextRef;
    this.objectMap.set(ref, objectId);
    return ref;
  }

  formatRemoteObj(obj) {
    if (!obj) return { value: "undefined", type: "undefined", variablesReference: 0 };
    if (obj.type === "undefined") return { value: "undefined", type: "undefined", variablesReference: 0 };
    if (obj.subtype === "null") return { value: "null", type: "null", variablesReference: 0 };
    if (obj.type === "string") return { value: JSON.stringify(obj.value ?? ""), type: "string", variablesReference: 0 };
    if (obj.type === "number" || obj.type === "boolean" || obj.type === "bigint") {
      return { value: String(obj.description ?? obj.value), type: obj.type, variablesReference: 0 };
    }
    if (obj.type === "object" || obj.type === "function") {
      let summary = obj.description || obj.className || obj.type;
      if (obj.preview && Array.isArray(obj.preview.properties)) {
        const parts = obj.preview.properties.slice(0, 6).map((p) =>
          obj.subtype === "array" ? (p.value ?? "…") : `${p.name}: ${p.value ?? "…"}`
        );
        if (obj.preview.overflow) parts.push("…");
        summary = obj.subtype === "array" ? `[${parts.join(", ")}]` : `{${parts.join(", ")}}`;
      }
      const vref = obj.type === "object" && obj.objectId ? this.allocObj(obj.objectId) : 0;
      return { value: summary, type: obj.className || obj.subtype || obj.type, variablesReference: vref };
    }
    return { value: String(obj.description ?? obj.value ?? ""), type: obj.type || "unknown", variablesReference: 0 };
  }

  kill() {
    this.exited = true;
    try { if (this.ws) this.ws.close(); } catch {}
    if (this.child && !this.child.killed) {
      try { this.child.kill("SIGKILL"); } catch {}
    }
  }
}

const dbg = new InspectorClient();

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
      if (args.stopOnEntry) dbg.stopOnEntry = true;
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
      sendResponse(req, true, { threads: [{ id: 1, name: "Main" }] });
      return;
    }
    if (cmd === "stackTrace") {
      const stackFrames = dbg.callFrames.map((cf) => {
        const fid = ++dbg.nextRef;
        dbg.frameMap.set(fid, cf);
        const line = cf.location ? Number(cf.location.lineNumber) + 1 : 1;
        return {
          id: fid,
          name: cf.functionName || "<main>",
          line,
          column: (cf.location ? Number(cf.location.columnNumber) : 0) + 1,
          source: { name: USER_BASE, path: USER_FULL },
        };
      });
      sendResponse(req, true, { stackFrames, totalFrames: stackFrames.length });
      return;
    }
    if (cmd === "scopes") {
      const cf = dbg.frameMap.get(Number(args.frameId)) || dbg.callFrames[0];
      if (!cf) { sendResponse(req, true, { scopes: [] }); return; }
      const allowed = new Set(["local", "closure", "block", "script", "module"]);
      let scopes = (cf.scopeChain || [])
        .filter((s) => allowed.has(s.type) && s.object && s.object.objectId)
        .map((s) => ({
          name: s.type === "local" ? "Locals" : s.type === "closure" ? "Closure" : "Scope",
          variablesReference: dbg.allocObj(s.object.objectId),
          expensive: false,
        }));
      sendResponse(req, true, { scopes });
      return;
    }
    if (cmd === "variables") {
      const objectId = dbg.objectMap.get(Number(args.variablesReference));
      if (!objectId) { sendResponse(req, true, { variables: [] }); return; }
      const res = await dbg.cdp("Runtime.getProperties", {
        objectId,
        ownProperties: true,
        generatePreview: true,
      });
      const variables = [];
      for (const prop of res.result || []) {
        if (!prop.enumerable && prop.name !== "length") continue;
        if (prop.name === "__judge" || prop.name === "__read" || prop.name === "__write") continue;
        const fmt = dbg.formatRemoteObj(prop.value);
        variables.push({ name: prop.name, ...fmt });
      }
      sendResponse(req, true, { variables });
      return;
    }
    if (cmd === "evaluate") {
      const cf = dbg.frameMap.get(Number(args.frameId)) || dbg.callFrames[0];
      if (!cf) { sendResponse(req, true, { result: "<未暂停>", variablesReference: 0 }); return; }
      const res = await dbg.cdp("Debugger.evaluateOnCallFrame", {
        callFrameId: cf.callFrameId,
        expression: String(args.expression || ""),
        generatePreview: true,
      });
      if (res.exceptionDetails) {
        sendResponse(req, false, undefined, res.exceptionDetails.text || "求值失败");
        return;
      }
      const fmt = dbg.formatRemoteObj(res.result);
      sendResponse(req, true, { result: fmt.value, type: fmt.type, variablesReference: fmt.variablesReference });
      return;
    }
    if (cmd === "continue" || cmd === "next" || cmd === "stepIn" || cmd === "stepOut") {
      dbg.paused = false;
      dbg.isStepping = cmd !== "continue";
      const map = {
        continue: "Debugger.resume",
        next: "Debugger.stepOver",
        stepIn: "Debugger.stepInto",
        stepOut: "Debugger.stepOut",
      };
      await dbg.cdp(map[cmd], {});
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
