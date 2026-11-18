"use strict";
// Go 调试：用 Delve（dlv）无界面启动程序，通过它的 JSON-RPC 接口一步一步走，记下行号、调用栈、变量；格式和网站浏览器里的执行记录一样。
// 做法：用户代码里的每个函数（含闭包）都下断点，进到函数里以后一行一行 next；函数返回时记一步 return（带返回值），
// 回到判题程序里就 continue 到下一个用户函数。panic（会被判题程序 recover）记成一步 exception。
const net = require("net"), cp = require("child_process"), fs = require("fs"), path = require("path");
const { killTree } = require("../exec");

const LOAD = { FollowPointers: true, MaxVariableRecurse: 1, MaxStringLen: 64, MaxArrayValues: 12, MaxStructFields: -1 };
const DEEP = { FollowPointers: true, MaxVariableRecurse: 13, MaxStringLen: 64, MaxArrayValues: 12, MaxStructFields: 3 };
const K = { Bool: 1, Array: 17, Chan: 18, Func: 19, Interface: 20, Map: 21, Ptr: 22, Slice: 23, String: 24, Struct: 25 };
const FLAG_SHADOWED = 2, FLAG_RETURN = 16;

function client(sock) {
  let id = 0, buf = "";
  const pending = new Map();
  sock.on("data", (b) => {
    buf += b.toString("utf8");
    for (let i; (i = buf.indexOf("\n")) >= 0;) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const p = pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(String(msg.error))); else p.resolve(msg.result);
    }
  });
  const fail = (e) => { for (const p of pending.values()) p.reject(e); pending.clear(); };
  sock.on("error", fail);
  sock.on("close", () => fail(new Error("dlv 断开了连接")));
  return {
    call(method, params = {}) {
      const myId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(myId, { resolve, reject });
        sock.write(JSON.stringify({ method: "RPCServer." + method, params: [params], id: myId }) + "\n");
      });
    },
    close() { sock.destroy(); },
  };
}

const short = (t) => String(t || "").replace(/\bmain\./g, "");
const quote = (s, len) => JSON.stringify(s.length > 60 ? s.slice(0, 59) + "…" : s) + (len > s.length && s.length <= 60 ? "…" : "");

function fmt(v, depth = 0) {
  if (!v) return "nil";
  if (v.unreadable) return "<无法读取>";
  const kids = v.children || [];
  switch (v.kind) {
    case K.String: return quote(v.value || "", v.len || 0);
    case K.Slice: case K.Array: {
      if (v.kind === K.Slice && v.base === 0 && !v.len) return "nil";
      if (v.len && !kids.length) return `${short(v.type)}(${v.len}) […]`;
      const items = kids.map((c) => fmt(c, depth + 1));
      return `${short(v.type)}(${v.len}) [${items.join(", ")}${v.len > kids.length ? ", …" : ""}]`;
    }
    case K.Map: {
      if (v.len && !kids.length) return `${short(v.type)}(${v.len}) {…}`;
      const items = [];
      for (let i = 0; i + 1 < kids.length; i += 2) items.push(`${fmt(kids[i], depth + 1)}: ${fmt(kids[i + 1], depth + 1)}`);
      return `${short(v.type)}(${v.len}) {${items.join(", ")}${v.len > items.length ? ", …" : ""}}`;
    }
    case K.Ptr: {
      const to = kids[0];
      if (!to || !to.addr) return "nil";
      const t = short(v.type);
      if (t === "*ListNode") return listOf(v);
      if ((t === "*TreeNode" || t === "*Node") && to.children) {
        const val = to.children.find((c) => c.name === "Val");
        if (val) return `${t.slice(1)}(${fmt(val, 3)})`;
      }
      if (to.kind === K.Struct && depth === 0) return "→ " + fmt(to, depth + 1);
      return t;
    }
    case K.Struct: {
      const t = short(v.type);
      if (depth >= 2 || (!kids.length && v.len)) return `${t} {…}`;
      const parts = kids.slice(0, 8).map((c) => `${c.name}: ${fmt(c, depth + 1)}`);
      return `${t} {${parts.join(", ")}${kids.length > 8 ? ", …" : ""}}`;
    }
    case K.Interface: return kids[0] && kids[0].kind ? fmt(kids[0], depth) : "nil";
    case K.Func: return v.value ? "func" : "nil";
    case K.Chan: return short(v.type);
    default: return v.value === undefined || v.value === "" ? short(v.type) : String(v.value);
  }
}

/** 链表：一直往下走（最多 12 个），要用 DEEP 读出来的变量 */
function listOf(v) {
  const out = [];
  let p = v;
  while (p && p.children && p.children[0] && p.children[0].addr && out.length < 12) {
    const node = p.children[0];
    const val = (node.children || []).find((c) => c.name === "Val"), next = (node.children || []).find((c) => c.name === "Next");
    out.push(val ? fmt(val, 3) : "?");
    p = next;
  }
  if (p && p.children && p.children[0] && p.children[0].addr) out.push("…");
  else if (p && p.kind === K.Ptr && !p.children?.length && out.length >= 1) out.push("…");
  return `ListNode(${out.join(" → ")})`;
}

const fnName = (name) => {
  const s = short(name || "?");
  const last = s.split(".").pop();
  return /^func\d+$/.test(last) ? "func" : last;
};

/**
 * 在 dlv 下跑一遍程序，返回 { trace, timedOut }。
 * exe/args：程序和参数；stdin/stdout/stderr：重定向的文件；user：用户代码的文件名（sol.go），off/n：它在文件里的位置。
 */
async function traceGo({ exe, args, cwd, stdin, stdout, stderr, user, off, n, limit = 1000, outSkip = 0, timeoutMs = 25000, maxRaw = 20000 }) {
  const steps = [];
  let bytes = 0, full = false, raw = 0, timedOut = false;
  const dlv = cp.spawn("dlv", ["exec", exe, "--headless", "--api-version=2", "--listen=127.0.0.1:0", "--accept-multiclient=false", "--log=false",
    "-r", `stdin:${stdin}`, "-r", `stdout:${stdout}`, "-r", `stderr:${stderr}`, "--", ...args], { cwd, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
  let dlvErr = "";
  dlv.stderr.on("data", (b) => { dlvErr = (dlvErr + b).slice(-4000); });
  const killer = setTimeout(() => { timedOut = true; killTree(dlv); }, timeoutMs);
  let rpc;
  try {
    const addr = await new Promise((resolve, reject) => {
      let out = "";
      const t = setTimeout(() => reject(new Error("dlv 启动超时：" + dlvErr)), 15000);
      dlv.stdout.on("data", (b) => {
        out += b;
        const m = out.match(/listening at: ([\d.]+):(\d+)/);
        if (m) { clearTimeout(t); resolve({ host: m[1], port: Number(m[2]) }); }
      });
      dlv.on("exit", () => { clearTimeout(t); reject(new Error("dlv 启动失败：" + dlvErr.trim())); });
    });
    rpc = await new Promise((resolve, reject) => {
      const s = net.connect(addr.port, addr.host, () => resolve(client(s)));
      s.on("error", reject);
    });

    const userLine = (file, line) => (file && path.basename(file) === user && line - off >= 1 && line - off <= n ? line - off : null);
    const outLen = () => { try { return Math.max(0, fs.statSync(stdout).size - outSkip); } catch { return 0; } };
    const record = (step) => {
      steps.push(step);
      bytes += JSON.stringify(step).length;
      if (steps.length >= limit || bytes > 600000) full = true;
    };
    const scope = { GoroutineID: -1, Frame: 0, DeferredCall: 0 };
    const stack = async (gid) => {
      const r = await rpc.call("Stacktrace", { Id: gid, Depth: 64, Full: false, Defers: false, Opts: 0 });
      return (r.Locations || []).map((f) => [fnName(f.function && f.function.name), userLine(f.file, f.line)]).filter((f) => f[1] !== null).reverse();
    };
    const vars = async () => {
      const [a, l] = await Promise.all([rpc.call("ListFunctionArgs", { Scope: scope, Cfg: LOAD }), rpc.call("ListLocalVars", { Scope: scope, Cfg: LOAD })]);
      const out = [];
      for (const v of [...(a.Args || []), ...(l.Variables || [])]) {
        if (!v.name || v.name.startsWith("~") || v.name === "_" || (v.flags & (FLAG_SHADOWED | FLAG_RETURN))) continue;
        let shown;
        if (short(v.type) === "*ListNode") {
          try { shown = listOf((await rpc.call("Eval", { Scope: scope, Expr: v.name, Cfg: DEEP })).Variable); } catch { shown = fmt(v); }
        } else shown = fmt(v);
        out.push([v.name, shown]);
        if (out.length >= 40) break;
      }
      return out;
    };
    const command = async (name) => (await rpc.call("Command", { name, ReturnInfoLoadConfig: LOAD })).State;

    // 用户代码里的每个函数都下断点（判题程序、前置代码里的函数下完再删掉）
    const { Funcs = [] } = await rpc.call("ListFunctions", { Filter: "^main\\." });
    for (const fn of Funcs) {
      try {
        const { Breakpoint: bp } = await rpc.call("CreateBreakpoint", { Breakpoint: { functionName: fn } });
        if (!userLine(bp.file, bp.line)) await rpc.call("ClearBreakpoint", { Id: bp.id });
      } catch {}
    }
    try { await rpc.call("CreateBreakpoint", { Breakpoint: { functionName: "runtime.gopanic", name: "panic" } }); } catch {}

    let st = await command("continue"), last = null;
    while (st && !st.exited && !full && raw < maxRaw) {
      raw++;
      const th = st.currentThread;
      if (!th) break;
      if (th.breakPoint && th.breakPoint.name === "panic") {
        // panic：记在最里层的用户代码那一行，值从 gopanic 的参数里读
        const frames = await stack(th.goroutineID);
        const top = frames[frames.length - 1];
        if (top) {
          let exc = "panic";
          try {
            const { Args = [] } = await rpc.call("ListFunctionArgs", { Scope: scope, Cfg: LOAD });
            if (Args[0]) exc = "panic: " + fmt(Args[0]).replace(/^"|"$/g, "");
          } catch {}
          record({ line: top[1], event: "exception", fn: top[0], stack: frames, vars: [], out: outLen(), exc });
        }
        if (st.NextInProgress) await rpc.call("CancelNext", {});
        last = null;
        st = await command("continue");
        continue;
      }
      const line = userLine(th.file, th.line);
      const frames = line ? await stack(th.goroutineID) : [];
      // 上一步所在的函数返回了：记一步 return
      if (last && frames.length < last.depth) {
        const rv = (th.ReturnValues || [])[0];
        record({ ...last.step, event: "return", out: outLen(), ...(rv ? { ret: fmt(rv) } : {}) });
        last = null;
        if (full) break;
      }
      if (!line) {
        if (st.NextInProgress) await rpc.call("CancelNext", {});
        last = null;
        st = await command("continue");
        continue;
      }
      const step = { line, event: "line", fn: fnName(th.function && th.function.name), stack: frames, vars: await vars(), out: outLen() };
      record(step);
      last = { step, depth: frames.length };
      if (st.NextInProgress) await rpc.call("CancelNext", {});
      st = await command("next");
    }
    if (st && !st.exited) { try { await rpc.call("Detach", { Kill: true }); } catch {} }
  } catch (e) {
    if (!timedOut && !steps.length) return { trace: { steps, truncated: false, limit }, error: String(e.message || e) };
  } finally {
    clearTimeout(killer);
    if (rpc) rpc.close();
    killTree(dlv);
  }
  return { trace: { steps, truncated: full || raw >= maxRaw, limit }, timedOut };
}

module.exports = { traceGo, fmt };
