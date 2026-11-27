#!/usr/bin/env node
"use strict";
// 沙箱内交互式 DAP 调试器桥（在隔离的 Firecracker microVM 或 Docker 容器内运行，绝不在宿主机运行用户代码）：
//   1) 复用 programs.js（力扣模式 / ACM 模式）与 toolchain.js 编译带调试符号的目标程序；
//   2) 拉起语言原生 DAP 适配器：Go 用 dlv dap，C++ 用 gdb -q -nx -i=dap（或 lldb-dap），Java 用 JdiDap；
//   3) 自动在浏览器行号（1..n）与生成源码行号（off+1..off+n）之间做双向偏移转换，并自动补全 launch 的可执行路径与参数；
//   4) 支持两种传输模式：
//      - stdio（Docker / Local）：首行读 JSON 初始化任务，首行输出 JSON 状态，随后 stdin/stdout 直接透传 Content-Length DAP 帧；
//      - daemon <stateDir> / poll <stateDir> <waitMs>（Firecracker microVM，配合 fc-manager 的 /agent/v1/exec 无状态 RPC）。
const fs = require("fs"), path = require("path"), net = require("net"), crypto = require("crypto"), cp = require("child_process");
const { leetcodeProgram, acmProgram } = require("./programs");
const { compile, PREP, exists, PY, RUBY_ENV } = require("./toolchain");
const { run, killTree } = require("./exec");

const WORK = process.env.RUNNER_WORK || "/work";
const DEBUG_LANGS = ["python", "java", "cpp", "go", "javascript", "typescript", "c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"];
const JDI_LANGS = new Set(["java", "kotlin", "scala"]);
const GDB_LANGS = new Set(["cpp", "c", "rust", "swift"]);

function frameBuf(jsonStr) {
  const b = Buffer.from(jsonStr, "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${b.length}\r\n\r\n`, "ascii"), b]);
}

class DapFrameParser {
  constructor(onFrame) {
    this.buf = Buffer.alloc(0);
    this.onFrame = onFrame;
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
      const body = this.buf.slice(sep + 4, sep + 4 + len).toString("utf8");
      this.buf = this.buf.slice(sep + 4 + len);
      this.onFrame(body);
    }
  }
}

async function ensureJdiDir(workDir) {
  const prebuilt = path.join(PREP, "jdi");
  if (exists(path.join(prebuilt, "JdiDap.class"))) return prebuilt;
  const out = path.join(workDir, "jdi");
  fs.mkdirSync(out, { recursive: true });
  const r = await run("javac", ["-encoding", "UTF-8", "-d", out, path.join(__dirname, "trace", "JdiDap.java")], { timeoutMs: 60000 });
  if (r.code !== 0) throw new Error("编译 JdiDap 失败：" + (r.stderr || r.stdout));
  return out;
}

async function prepareAndSpawnAdapter(spec, workDir) {
  fs.mkdirSync(workDir, { recursive: true });
  workDir = fs.realpathSync(workDir);
  if (!spec || !DEBUG_LANGS.includes(spec.lang)) throw new Error("不支持的调试语言：" + (spec && spec.lang));
  const mode = spec.mode === "leetcode" ? "leetcode" : "acm";
  const cases = Array.isArray(spec.cases) && spec.cases.length ? [spec.cases[0]] : [mode === "acm" ? { stdin: String(spec.stdin || "") } : { input: [] }];
  const job = { lang: spec.lang, mode, code: String(spec.code || ""), sig: spec.sig, cases, debug: true };
  const prog = mode === "acm" ? acmProgram(job) : leetcodeProgram(job);

  const tok = mode === "acm" ? "" : crypto.randomBytes(6).toString("hex");
  const stdinFile = path.join(workDir, "dap.stdin");
  fs.writeFileSync(stdinFile, mode === "acm" ? String(cases[0].stdin || spec.stdin || "") : "");

  // ACM 模式下为 Go / C++ 注入无侵入的 dap.stdin 重定向，避免占用调试器自身的 DAP 通信流或受 dlv/gdb 版本限制
  if (mode === "acm" && spec.lang === "go") {
    prog.files["cd_dap_stdin.go"] = 'package main\nimport "os"\nfunc init() { if f, err := os.Open("dap.stdin"); err == nil { os.Stdin = f } }\n';
  } else if (mode === "acm" && spec.lang === "cpp") {
    prog.files[prog.user] = '#include <cstdio>\nstatic FILE* __cd_dap_in = freopen("dap.stdin", "r", stdin);\n' + prog.files[prog.user];
    prog.off += 2;
  }

  const built = await compile(spec.lang, prog, workDir, { debug: true, acm: mode === "acm" });
  if (!built.ok) return { ok: false, compileError: built.error };

  const progArgs = mode === "acm" ? [] : [...prog.args(0, tok), ...(spec.lang === "cpp" ? ["debug"] : [])];
  const userFullPath = path.join(workDir, prog.user);

  let inStream, outStream, killFn, onCloseFn, needsLineShift = false, gdbFlavor = "";
  if (JDI_LANGS.has(spec.lang)) {
    const jdiCp = await ensureJdiDir(workDir);
    const child = cp.spawn("java", ["-cp", jdiCp, "JdiDap", stdinFile, prog.user, String(prog.off), String(prog.n), tok, built.cmd.classpath, built.cmd.main, ...progArgs], {
      cwd: workDir, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32",
    });
    inStream = child.stdin;
    outStream = child.stdout;
    killFn = () => killTree(child);
    onCloseFn = (fn) => child.on("close", fn);
  } else if (spec.lang === "go") {
    needsLineShift = true;
    const child = cp.spawn("dlv", ["dap", "--listen=127.0.0.1:0", "--log=false"], {
      cwd: workDir, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32",
    });
    let dlvErr = "";
    child.stderr.on("data", (b) => { dlvErr = (dlvErr + b).slice(-4000); });
    const addr = await new Promise((resolve, reject) => {
      let out = "";
      const t = setTimeout(() => reject(new Error("dlv dap 启动超时：" + dlvErr)), 15000);
      child.stdout.on("data", (b) => {
        out += b.toString("utf8");
        const m = out.match(/listening at:\s*([\d.]+):(\d+)/i);
        if (m) { clearTimeout(t); resolve({ host: m[1], port: Number(m[2]) }); }
      });
      child.once("exit", () => { clearTimeout(t); reject(new Error("dlv dap 启动失败：" + dlvErr.trim())); });
    });
    const sock = await new Promise((resolve, reject) => {
      const s = net.connect(addr.port, addr.host, () => resolve(s));
      s.once("error", reject);
    });
    inStream = sock;
    outStream = sock;
    killFn = () => { try { sock.destroy(); } catch {} killTree(child); };
    onCloseFn = (fn) => {
      let called = false;
      const once = () => { if (!called) { called = true; fn(); } };
      sock.on("close", once);
      child.on("close", once);
    };
  } else if (GDB_LANGS.has(spec.lang)) {
    needsLineShift = true;
    const hasGdb = exists("/usr/bin/gdb") || cp.spawnSync("gdb", ["--version"], { stdio: "ignore" }).status === 0;
    gdbFlavor = hasGdb ? "gdb" : "lldb";
    const child = hasGdb
      ? cp.spawn("gdb", ["-q", "-nx", "-i=dap"], { cwd: workDir, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32" })
      : cp.spawn("lldb-dap", [], { cwd: workDir, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32" });
    inStream = child.stdin;
    outStream = child.stdout;
    killFn = () => killTree(child);
    onCloseFn = (fn) => child.on("close", fn);
  } else if (spec.lang === "csharp") {
    needsLineShift = true;
    const child = cp.spawn("netcoredbg", ["--interpreter=vscode"], {
      cwd: workDir, env: built.cmd.env || process.env, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32",
    });
    inStream = child.stdin;
    outStream = child.stdout;
    killFn = () => killTree(child);
    onCloseFn = (fn) => child.on("close", fn);
  } else {
    needsLineShift = true;
    const scriptArgs = prog.args(0, tok).slice(1);
    let bin, spawnArgs, env = process.env;
    if (spec.lang === "python") {
      bin = PY[0];
      spawnArgs = [...PY.slice(1), "-X", "utf8", path.join(__dirname, "trace", "py_dap.py"), userFullPath, String(prog.off), String(prog.n), stdinFile, userFullPath, ...scriptArgs];
    } else if (spec.lang === "javascript" || spec.lang === "typescript") {
      bin = process.execPath;
      spawnArgs = [path.join(__dirname, "trace", "node_dap.js"), spec.lang, userFullPath, String(prog.off), String(prog.n), stdinFile, userFullPath, ...scriptArgs];
    } else if (spec.lang === "ruby") {
      bin = "ruby";
      spawnArgs = ["-E", "UTF-8:UTF-8", "-W0", path.join(__dirname, "trace", "ruby_dap.rb"), userFullPath, String(prog.off), String(prog.n), stdinFile, userFullPath, ...scriptArgs];
      env = { ...process.env, RUBY_THREAD_VM_STACK_SIZE: RUBY_ENV.RUBY_THREAD_VM_STACK_SIZE };
    } else if (spec.lang === "dart") {
      bin = process.execPath;
      const dartArgs = mode === "acm" ? [] : prog.args(0, tok);
      spawnArgs = [path.join(__dirname, "trace", "dart_dap.js"), userFullPath, String(prog.off), String(prog.n), stdinFile, built.cmd.dill || userFullPath, ...dartArgs];
    } else if (spec.lang === "php") {
      bin = process.execPath;
      spawnArgs = [path.join(__dirname, "trace", "php_dap.js"), userFullPath, String(prog.off), String(prog.n), stdinFile, userFullPath, mode === "acm" ? "1" : "0", ...scriptArgs];
    }
    const child = cp.spawn(bin, spawnArgs, {
      cwd: workDir, env, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32",
    });
    inStream = child.stdin;
    outStream = child.stdout;
    killFn = () => killTree(child);
    onCloseFn = (fn) => child.on("close", fn);
  }

  return {
    ok: true,
    inStream,
    outStream,
    kill: killFn,
    onClose: onCloseFn,
    meta: {
      lang: spec.lang, mode, userFile: prog.user, userFullPath, off: prog.off, n: prog.n,
      exe: built.cmd.exe, dll: built.cmd.dll, progArgs, stdinFile, workDir, tok, cppFlavor: gdbFlavor, needsLineShift,
      gdbConfigDone: false, pendingGdbLaunch: null, suppressGdbLaunchSeq: null,
    },
  };
}

function processClientFrame(rawJson, meta, sendToAdapter, sendToClient) {
  let msg;
  try { msg = JSON.parse(rawJson); } catch { sendToAdapter(rawJson); return; }
  if (msg.type === "request" && msg.command === "launch") {
    const a = msg.arguments || {};
    if (meta.lang === "go") {
      msg.arguments = { request: "launch", mode: "exec", program: meta.exe, args: meta.progArgs, cwd: meta.workDir, ...(a.stopOnEntry ? { stopOnEntry: true } : {}) };
    } else if (GDB_LANGS.has(meta.lang)) {
      msg.arguments = meta.cppFlavor === "gdb"
        ? { program: meta.exe, args: meta.progArgs, cwd: meta.workDir, ...(a.stopAtBeginningOfMainSubprogram ? { stopAtBeginningOfMainSubprogram: true } : {}) }
        : { program: meta.exe, args: meta.progArgs, cwd: meta.workDir, ...(a.stopOnEntry ? { stopOnEntry: true } : {}) };
    } else if (meta.lang === "csharp") {
      msg.arguments = { request: "launch", type: "coreclr", program: "dotnet", args: [meta.dll, ...meta.progArgs], cwd: meta.workDir, stopAtEntry: !!a.stopOnEntry };
    }
    // GDB 15+ 的原生 DAP 在 launch 里就会立刻执行 run；先暂存 launch 并回 ACK，等 setBreakpoints 完成且收到 configurationDone 后再放行给 GDB。
    if (meta.cppFlavor === "gdb" && !meta.gdbConfigDone) {
      meta.pendingGdbLaunch = JSON.stringify(msg);
      meta.suppressGdbLaunchSeq = msg.seq;
      sendToClient(JSON.stringify({ seq: 0, type: "response", request_seq: msg.seq, success: true, command: "launch" }));
      return;
    }
    sendToAdapter(JSON.stringify(msg));
    return;
  }
  if (meta.cppFlavor === "gdb" && msg.type === "request" && msg.command === "configurationDone") {
    meta.gdbConfigDone = true;
    if (meta.pendingGdbLaunch !== null) {
      const deferred = meta.pendingGdbLaunch;
      meta.pendingGdbLaunch = null;
      sendToAdapter(deferred);
    }
    sendToAdapter(rawJson);
    return;
  }
  if (meta.needsLineShift && msg.type === "request" && msg.command === "setBreakpoints" && msg.arguments) {
    msg.arguments.source = { ...(msg.arguments.source || {}), name: meta.userFile, path: meta.userFullPath };
    if (Array.isArray(msg.arguments.breakpoints)) {
      msg.arguments.breakpoints = msg.arguments.breakpoints.map((bp) => ({ ...bp, line: Number(bp.line) + meta.off }));
    }
    sendToAdapter(JSON.stringify(msg));
    return;
  }
  sendToAdapter(rawJson);
}

function rewriteAdapterToClient(rawJson, meta) {
  let msg;
  try { msg = JSON.parse(rawJson); } catch { return rawJson; }
  if (meta.cppFlavor === "gdb" && meta.suppressGdbLaunchSeq !== null && msg.type === "response" && msg.command === "launch" && msg.request_seq === meta.suppressGdbLaunchSeq) {
    meta.suppressGdbLaunchSeq = null;
    if (msg.success !== false) return null;
    return JSON.stringify({ seq: 0, type: "event", event: "terminated", body: { error: msg.message || "gdb launch failed" } });
  }
  if (meta.tok && msg.type === "event" && msg.event === "output" && msg.body && typeof msg.body.output === "string") {
    const re = new RegExp("\\x01" + meta.tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":[SR]:[^\\x02]*\\x02", "g");
    msg.body.output = msg.body.output.replace(re, "");
    return JSON.stringify(msg);
  }
  if (!meta.needsLineShift || meta.off === 0) return rawJson;
  const isUserSrc = (src) => src && (src.name === meta.userFile || (src.path && path.basename(src.path) === meta.userFile));
  if (msg.type === "response" && msg.command === "setBreakpoints" && msg.body && Array.isArray(msg.body.breakpoints)) {
    msg.body.breakpoints = msg.body.breakpoints.map((bp) => ({ ...bp, ...(typeof bp.line === "number" ? { line: Math.max(1, bp.line - meta.off) } : {}) }));
    return JSON.stringify(msg);
  }
  if (msg.type === "response" && msg.command === "stackTrace" && msg.body && Array.isArray(msg.body.stackFrames)) {
    msg.body.stackFrames = msg.body.stackFrames.map((f) => (isUserSrc(f.source) && typeof f.line === "number" ? { ...f, line: Math.max(1, f.line - meta.off), source: { name: meta.userFile } } : f));
    return JSON.stringify(msg);
  }
  return rawJson;
}

function readFirstLine(stream) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const nl = buf.indexOf(0x0a);
      if (nl >= 0) {
        stream.off("data", onData);
        const line = buf.slice(0, nl).toString("utf8");
        const rest = buf.slice(nl + 1);
        resolve({ line, rest });
      }
    };
    stream.on("data", onData);
    stream.once("error", reject);
    stream.once("end", () => resolve({ line: buf.toString("utf8"), rest: Buffer.alloc(0) }));
  });
}

async function runStdioMode() {
  const workDir = path.join(WORK, "dap-" + crypto.randomBytes(6).toString("hex"));
  fs.mkdirSync(workDir, { recursive: true });
  const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {} };
  try {
    const { line, rest } = await readFirstLine(process.stdin);
    const spec = JSON.parse(line);
    const started = await prepareAndSpawnAdapter(spec, workDir);
    if (!started.ok) {
      process.stdout.write(JSON.stringify({ ok: false, compileError: started.compileError }) + "\n");
      cleanup();
      process.exit(0);
    }
    const { inStream, outStream, kill, onClose, meta } = started;
    process.stdout.write(JSON.stringify({ ok: true, lang: meta.lang, mode: meta.mode, userFile: meta.userFile, lines: meta.n }) + "\n");

    const fromAdapter = new DapFrameParser((frame) => {
      const out = rewriteAdapterToClient(frame, meta);
      if (out !== null) process.stdout.write(frameBuf(out));
    });
    outStream.on("data", (c) => fromAdapter.push(c));
    onClose(() => { cleanup(); process.exit(0); });

    const fromClient = new DapFrameParser((frame) => {
      processClientFrame(
        frame,
        meta,
        (raw) => inStream.write(frameBuf(raw)),
        (raw) => process.stdout.write(frameBuf(raw)),
      );
    });
    if (rest.length) fromClient.push(rest);
    process.stdin.on("data", (c) => fromClient.push(c));
    process.stdin.on("end", () => { kill(); cleanup(); });
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: String(e && e.message || e) }) + "\n");
    cleanup();
    process.exit(0);
  }
}

// Firecracker microVM daemon mode: compiles once & keeps DAP adapter running behind a local Unix socket in stateDir.
async function runDaemonSetup(stateDir) {
  fs.mkdirSync(stateDir, { recursive: true });
  const raw = fs.readFileSync(0, "utf8");
  fs.writeFileSync(path.join(stateDir, "spec.json"), raw);
  const errPath = path.join(stateDir, "worker.err");
  const errFd = fs.openSync(errPath, "a");
  let bgExited = false;
  let bgCode = null;
  const bg = cp.spawn(process.execPath, [__filename, "daemon-worker", stateDir], {
    detached: true,
    stdio: ["ignore", "ignore", errFd],
  });
  fs.closeSync(errFd);
  bg.once("exit", (code) => { bgExited = true; bgCode = code; });
  bg.unref();

  const statusPath = path.join(stateDir, "status.json");
  for (let i = 0; i < 1000; i++) {
    if (exists(statusPath)) {
      process.stdout.write(fs.readFileSync(statusPath, "utf8"));
      return;
    }
    if (bgExited && i >= 2) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  let tailErr = "";
  try { tailErr = fs.readFileSync(errPath, "utf8").trim().split(/\r?\n/).slice(-4).join(" | "); } catch {}
  process.stdout.write(JSON.stringify({ ok: false, error: `microVM 内 DAP 守护进程启动失败${bgExited ? `（退出码 ${bgCode}）` : "（超时）"}` + (tailErr ? "：" + tailErr : "") }));
}

async function runDaemonWorker(stateDir) {
  const statusPath = path.join(stateDir, "status.json");
  const writeStatus = (obj) => {
    const tmp = statusPath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, statusPath);
  };
  try {
    const spec = JSON.parse(fs.readFileSync(path.join(stateDir, "spec.json"), "utf8"));
    const workDir = path.join(stateDir, "work");
    fs.mkdirSync(workDir, { recursive: true });
    const started = await prepareAndSpawnAdapter(spec, workDir);
    if (!started.ok) {
      writeStatus({ ok: false, compileError: started.compileError });
      process.exit(0);
    }
    const { inStream, outStream, kill, onClose, meta } = started;

    const outQueue = [];
    let waiter = null;
    let exited = false;

    const notify = () => { if (waiter) { const w = waiter; waiter = null; w(); } };
    const fromAdapter = new DapFrameParser((frame) => {
      const out = rewriteAdapterToClient(frame, meta);
      if (out !== null) {
        outQueue.push(out);
        notify();
      }
    });
    outStream.on("data", (c) => fromAdapter.push(c));
    onClose(() => { exited = true; notify(); setTimeout(() => process.exit(0), 2000); });

    const sockPath = path.join(stateDir, "dap.sock");
    const srv = net.createServer({ allowHalfOpen: true }, (conn) => {
      let reqBuf = "";
      conn.on("data", (c) => { reqBuf += c.toString("utf8"); });
      conn.on("end", async () => {
        try {
          const req = JSON.parse(reqBuf || "{}");
          for (const f of req.frames || []) {
            processClientFrame(
              f,
              meta,
              (raw) => inStream.write(frameBuf(raw)),
              (raw) => { outQueue.push(raw); notify(); },
            );
          }
          const rawWait = Number(req.waitMs);
          const waitMs = Number.isFinite(rawWait) ? Math.min(5000, Math.max(0, rawWait)) : 0;
          if (!outQueue.length && !exited && waitMs > 0) {
            await new Promise((resolve) => {
              const t = setTimeout(() => { if (waiter === done) waiter = null; resolve(); }, waitMs);
              const done = () => { clearTimeout(t); resolve(); };
              waiter = done;
            });
          }
          const batch = outQueue.splice(0, 64);
          conn.end(JSON.stringify({ ok: true, frames: batch, exited }));
          if (req.close) { kill(); srv.close(); process.exit(0); }
        } catch (e) {
          conn.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
        }
      });
    });
    srv.once("error", (err) => {
      try { writeStatus({ ok: false, error: String((err && err.message) || err) }); } catch {}
      process.exit(1);
    });
    srv.listen(sockPath, () => {
      writeStatus({ ok: true, lang: meta.lang, mode: meta.mode, userFile: meta.userFile, lines: meta.n });
    });
  } catch (e) {
    try { writeStatus({ ok: false, error: String((e && e.message) || e) }); } catch {}
    process.exit(1);
  }
}

async function runPoll(stateDir, waitMs) {
  const sockPath = path.join(stateDir, "dap.sock");
  const inRaw = fs.readFileSync(0, "utf8");
  const inReq = inRaw ? JSON.parse(inRaw) : {};
  const parsedWait = waitMs !== undefined && waitMs !== "" ? Number(waitMs) : 1000;
  const effWait = Number.isFinite(parsedWait) ? parsedWait : 1000;
  const reply = await new Promise((resolve) => {
    const c = net.connect(sockPath, () => {
      c.end(JSON.stringify({ frames: inReq.frames || [], waitMs: effWait, close: !!inReq.close }));
    });
    let out = "";
    c.on("data", (b) => { out += b.toString("utf8"); });
    c.on("end", () => resolve(out || '{"ok":true,"frames":[],"exited":true}'));
    c.on("error", (e) => resolve(JSON.stringify({ ok: false, error: e.message, exited: true })));
  });
  process.stdout.write(reply);
}

const modeArg = process.argv[2] || "stdio";
if (modeArg === "stdio") runStdioMode();
else if (modeArg === "daemon") runDaemonSetup(process.argv[3]);
else if (modeArg === "daemon-worker") runDaemonWorker(process.argv[3]);
else if (modeArg === "poll") runPoll(process.argv[3], process.argv[4]);
