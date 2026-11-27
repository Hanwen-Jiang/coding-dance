#!/usr/bin/env node
"use strict";
/**
 * PHP Debug Adapter Protocol (DAP) 服务端：
 * 驱动官方 phpdbg -qrr，零第三方扩展、无需 ptrace。
 * 用法：node php_dap.js <userFullPath> <off> <n> <stdinFile> <scriptPath> <acmFlag> [scriptArgs...]
 */
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");

const USER_FULL = fs.realpathSync(path.resolve(process.argv[2]));
const USER_BASE = path.basename(USER_FULL);
const OFF = Number(process.argv[3]);
const N = Number(process.argv[4]);
const STDIN_FILE = process.argv[5] || "";
const SCRIPT_PATH = path.resolve(process.argv[6]);
const ACM = process.argv[7] === "1";
const SCRIPT_ARGS = process.argv.slice(8);

const MARK = `__CDPHP_${crypto.randomBytes(6).toString("hex")}`;

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

class PhpdbgSession {
  constructor() {
    this.child = null;
    this.buf = "";
    this.promptWaiter = null;
    this.launched = false;
    this.configDone = false;
    this.startedRun = false;
    this.running = false;
    this.wantedLines = [];
    this.frames = [];
    this.varMap = new Map();
    this.nextRef = 100;
    this.exited = false;
    this.readyPromise = null;
  }

  ensureStarted() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve, reject) => {
      const args = ["-q", "-e", SCRIPT_PATH, ...SCRIPT_ARGS];
      this.child = cp.spawn("phpdbg", args, {
        cwd: path.dirname(SCRIPT_PATH),
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.child.stderr.on("data", (d) => {
        const text = d.toString("utf8");
        if (text) sendEvent("output", { category: "stderr", output: text });
      });
      this.child.once("error", reject);
      this.child.on("close", (code) => {
        if (this.exited) return;
        this.exited = true;
        sendEvent("exited", { exitCode: typeof code === "number" ? code : 0 });
        sendEvent("terminated", {});
        setTimeout(() => process.exit(0), 30);
      });

      this.child.stdout.on("data", (d) => {
        this.buf += d.toString("utf8").replace(/\x1b\[[0-9;]*m/g, "");
        this.drain();
      });

      this.waitPrompt().then(resolve, reject);
    });
    return this.readyPromise;
  }

  drain() {
    // Emit lines when settled at prompt> or flush non-marker lines while running
    const pIdx = this.buf.lastIndexOf("prompt> ");
    if (pIdx >= 0 && this.promptWaiter) {
      const chunk = this.buf.slice(0, pIdx);
      this.buf = this.buf.slice(pIdx + "prompt> ".length);
      const w = this.promptWaiter;
      this.promptWaiter = null;
      w(chunk);
    }
  }

  waitPrompt() {
    return new Promise((resolve) => {
      this.promptWaiter = resolve;
      this.drain();
    });
  }

  async cmd(line) {
    await this.ensureStarted();
    const p = this.waitPrompt();
    this.child.stdin.write(line + "\n");
    return await p;
  }

  filterAndEmitUserOutput(chunk) {
    const out = [];
    for (const line of chunk.split(/\r?\n/)) {
      if (!line) continue;
      if (line.includes(MARK)) continue;
      if (/^\[(?:Welcome to phpdbg|Please report bugs|Successful compilation|Breakpoint|Script ended|Set |Deleted |Cleared|L\d+)/.test(line)) continue;
      if (/^To get help using phpdbg/.test(line)) continue;
      if (/^>?\s*\d{4,}:/.test(line)) continue;
      out.push(line);
    }
    if (out.length) {
      sendEvent("output", { category: "stdout", output: out.join("\n") + "\n" });
    }
  }

  async evalTagged(tag, phpExpr) {
    const out = await this.cmd(`ev "${MARK}:${tag}:" . json_encode(${phpExpr}, JSON_PARTIAL_OUTPUT_ON_ERROR | JSON_UNESCAPED_UNICODE)`);
    const re = new RegExp(`${MARK}:${tag}:(.*)`);
    const m = out.match(re);
    if (!m) return null;
    try { return JSON.parse(m[1].trim()); } catch { return null; }
  }

  async afterStop(rawOutput, reason) {
    this.filterAndEmitUserOutput(rawOutput);
    if (/\[Script ended/.test(rawOutput)) {
      await this.cmd("q").catch(() => {});
      return;
    }
    const bt = await this.evalTagged("BT", "debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS)");
    const frames = Array.isArray(bt) ? bt : [];
    const userFrames = [];
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (!f || !f.file) continue;
      if (path.basename(f.file) !== USER_BASE) continue;
      const line = Number(f.line || 0);
      if (line > OFF && line <= OFF + N) {
        userFrames.push({
          idx: i,
          name: f.class ? `${f.class}::${f.function}` : (f.function || "<main>"),
          line,
        });
      }
    }
    if (!userFrames.length) {
      // Stopped in judge harness; continue running toward user code / end
      const nextRaw = await this.cmd("c");
      await this.afterStop(nextRaw, "breakpoint");
      return;
    }
    this.frames = userFrames;
    this.varMap.clear();
    sendEvent("stopped", { reason, threadId: 1, allThreadsStopped: true });
  }

  async syncBreakpoints(lines) {
    this.wantedLines = lines.slice();
    await this.ensureStarted();
    await this.cmd("b clear").catch(() => {});
    for (const ln of this.wantedLines) {
      if (ln > OFF && ln <= OFF + N) {
        await this.cmd(`b ${USER_FULL}:${ln}`).catch(() => {});
      }
    }
  }

  async maybeRun() {
    if (this.startedRun || !this.launched || !this.configDone) return;
    this.startedRun = true;
    await this.ensureStarted();
    const runCmd = ACM && STDIN_FILE && fs.existsSync(STDIN_FILE) ? `r < ${STDIN_FILE}` : "r";
    const out = await this.cmd(runCmd);
    await this.afterStop(out, "breakpoint");
  }

  kill() {
    this.exited = true;
    if (this.child && !this.child.killed) {
      try { this.child.kill("SIGKILL"); } catch {}
    }
  }
}

const dbg = new PhpdbgSession();

function formatPhpVal(val) {
  if (val === null) return { value: "null", type: "null", variablesReference: 0 };
  if (Array.isArray(val) || typeof val === "object") {
    const vref = ++dbg.nextRef;
    dbg.varMap.set(vref, val);
    return {
      value: JSON.stringify(val),
      type: Array.isArray(val) ? "array" : "object",
      variablesReference: vref,
    };
  }
  return {
    value: typeof val === "string" ? JSON.stringify(val) : String(val),
    type: typeof val,
    variablesReference: 0,
  };
}

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
      // Do not await maybeRun here synchronously or request chain blocks before configurationDone
      dbg.maybeRun().catch(() => {});
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
      dbg.maybeRun().catch(() => {});
      return;
    }
    if (cmd === "threads") {
      sendResponse(req, true, { threads: [{ id: 1, name: "main" }] });
      return;
    }
    if (cmd === "stackTrace") {
      const stackFrames = dbg.frames.map((f) => ({
        id: f.idx + 1,
        name: f.name,
        line: f.line,
        column: 1,
        source: { name: USER_BASE, path: USER_FULL },
      }));
      sendResponse(req, true, { stackFrames, totalFrames: stackFrames.length });
      return;
    }
    if (cmd === "scopes") {
      const vref = ++dbg.nextRef;
      dbg.varMap.set(vref, "__LOCALS__");
      sendResponse(req, true, { scopes: [{ name: "Locals", variablesReference: vref, expensive: false }] });
      return;
    }
    if (cmd === "variables") {
      const target = dbg.varMap.get(Number(args.variablesReference));
      if (!target) { sendResponse(req, true, { variables: [] }); return; }
      if (target === "__LOCALS__") {
        const vars = await dbg.evalTagged("VARS", "get_defined_vars()");
        const variables = [];
        if (vars && typeof vars === "object") {
          for (const [k, v] of Object.entries(vars)) {
            if (k.startsWith("__j") || k === "_GET" || k === "_POST" || k === "_COOKIE" || k === "_FILES" || k === "_SERVER" || k === "_ENV" || k === "GLOBALS") continue;
            variables.push({ name: "$" + k, ...formatPhpVal(v) });
          }
        }
        sendResponse(req, true, { variables });
        return;
      }
      const entries = Array.isArray(target) ? target.map((v, i) => [String(i), v]) : Object.entries(target);
      sendResponse(req, true, {
        variables: entries.slice(0, 60).map(([k, v]) => ({ name: k, ...formatPhpVal(v) })),
      });
      return;
    }
    if (cmd === "evaluate") {
      const expr = String(args.expression || "").trim().replace(/;+$/, "");
      const res = await dbg.evalTagged("EVAL", expr || "null");
      const fmt = formatPhpVal(res);
      sendResponse(req, true, { result: fmt.value, type: fmt.type, variablesReference: fmt.variablesReference });
      return;
    }
    if (cmd === "continue" || cmd === "next" || cmd === "stepIn" || cmd === "stepOut") {
      const map = { continue: "c", next: "n", stepIn: "s", stepOut: "f" };
      sendResponse(req, true, cmd === "continue" ? { allThreadsContinued: true } : {});
      const out = await dbg.cmd(map[cmd]);
      await dbg.afterStop(out, cmd === "continue" ? "breakpoint" : "step");
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
