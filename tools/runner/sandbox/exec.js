"use strict";
// 跑子进程：限时、限输出、超时杀整组进程；以及力扣模式「带分隔标记、一组崩了从下一组接着跑」的运行方式。
const cp = require("child_process");
const { StringDecoder } = require("string_decoder");

const WIN = process.platform === "win32";
const CASE_OUT = 16384; // 每组用例留给用户看的输出（字符）
const PROC_OUT = 8 << 20; // 一个进程最多输出这么多字节，超过就杀掉

function killTree(child) {
  try {
    if (!WIN && child.pid) process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  } catch { try { child.kill("SIGKILL"); } catch {} }
}

/**
 * 跑一个命令到结束。返回 { code, signal, stdout, stderr, timedOut, overflow, ms }。
 * input：写进标准输入的内容（null 表示不给标准输入）。onData(chunk)：边跑边看输出（调试器读端口号用）。
 */
function run(file, args, { cwd, env, input = null, timeoutMs = 30000, maxOut = PROC_OUT, maxErr = 64 << 10, onData } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let child;
    try {
      child = cp.spawn(file, args, { cwd, env: env || process.env, stdio: ["pipe", "pipe", "pipe"], detached: !WIN, windowsHide: true });
    } catch (e) {
      resolve({ code: -1, signal: null, stdout: "", stderr: String(e.message || e), timedOut: false, overflow: false, ms: 0 });
      return;
    }
    const out = [], err = [];
    let outBytes = 0, errBytes = 0, timedOut = false, overflow = false, done = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
    child.stdout.on("data", (b) => {
      if (onData) onData(b);
      if (outBytes + b.length > maxOut) { overflow = true; out.push(b.subarray(0, Math.max(0, maxOut - outBytes))); outBytes = maxOut; killTree(child); return; }
      out.push(b); outBytes += b.length;
    });
    child.stderr.on("data", (b) => {
      // 标准错误只留最后一段（崩溃信息在最后）
      err.push(b); errBytes += b.length;
      while (errBytes > maxErr && err.length > 1) errBytes -= err.shift().length;
    });
    child.stdin.on("error", () => {});
    if (input != null) child.stdin.end(input); else child.stdin.end();
    const finish = (code, signal, extraErr) => {
      if (done) return; done = true; clearTimeout(timer);
      resolve({ code, signal, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8").slice(-maxErr) + (extraErr || ""), timedOut, overflow, ms: Date.now() - t0 });
    };
    child.on("error", (e) => finish(-1, null, String(e.message || e)));
    child.on("close", (code, signal) => finish(code, signal));
  });
}

/** 一段输出按用户能看的长度截断 */
function clip(s, max = CASE_OUT) {
  return s.length > max ? s.slice(0, max) + `\n…（输出太长，只显示前 ${max} 个字符）` : s;
}

/**
 * 力扣模式：程序从第 from 组开始逐组运行，每组前后写分隔标记（见 programs.js）。
 * 每组限时 caseMs；超时、崩溃就从下一组重新启动程序。describe(r) 把进程的异常退出说成人话（各语言不一样）。
 * 返回 [{ index, actual, stdout, error?, duration }]，和网站浏览器里运行的结果同一个格式。
 */
async function runMarked({ file, args, cwd, env, n, caseMs, totalMs, startMs = 15000, tok, describe }) {
  const results = new Array(n).fill(null);
  const t0 = Date.now();
  let from = 0;
  while (from < n) {
    if (Date.now() - t0 > totalMs) {
      for (let k = from; k < n; k++) results[k] = { index: k, actual: null, stdout: "", error: "这次运行的总时间用完了，这一组没有运行", duration: 0 };
      break;
    }
    const r = await runFrom(from);
    if (r.cur >= 0 && !results[r.cur]) {
      // 这一组开始了但没跑完：超时、崩溃或者输出太多
      const why = r.caseTimedOut ? `超时：这一组运行超过 ${(caseMs / 1000).toFixed(caseMs % 1000 ? 1 : 0)} 秒（检查是不是死循环，或者复杂度太高）`
        : r.overflow ? "输出太多了（超过 8 MB），程序被停下" : describe(r);
      results[r.cur] = { index: r.cur, actual: null, stdout: clip(r.partial), error: why, duration: r.caseTimedOut ? caseMs : r.caseMs };
      from = r.cur + 1;
      continue;
    }
    const next = results.findIndex((x, k) => k >= from && !x);
    if (next < 0) break;
    if (r.started) { from = next; continue; }
    // 一组都没开始程序就退出了（启动失败、静态初始化崩溃、启动太慢）
    const why = r.timedOut ? "程序启动超时" : describe(r);
    for (let k = from; k < n; k++) results[k] = { index: k, actual: null, stdout: "", error: why, duration: 0 };
    break;
  }
  return results;

  function runFrom(start) {
    return new Promise((resolve) => {
      const child = cp.spawn(file, args(start, tok), { cwd, env: env || process.env, stdio: ["ignore", "pipe", "pipe"], detached: !WIN, windowsHide: true });
      const dec = new StringDecoder("utf8"), head = "\x01" + tok + ":";
      let buf = "", cur = -1, curStart = 0, started = false, caseTimedOut = false, timedOut = false, overflow = false, bytes = 0, partial = "";
      let err = "", done = false;
      let timer = setTimeout(() => { timedOut = true; killTree(child); }, startMs);
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => { caseTimedOut = true; killTree(child); }, caseMs); };
      const parse = () => {
        for (;;) {
          const i = buf.indexOf(head);
          if (i < 0) {
            // 留一截尾巴，标记可能被拆在两块数据里
            if (cur >= 0 && buf.length > head.length) { partial += buf.slice(0, buf.length - head.length); buf = buf.slice(buf.length - head.length); }
            return;
          }
          const j = buf.indexOf("\x02", i);
          if (j < 0) return;
          const text = buf.slice(0, i), body = buf.slice(i + head.length, j);
          buf = buf.slice(j + 1);
          if (cur >= 0) partial += text;
          const m = body.match(/^([SR]):(\d+)(?::([\s\S]*))?$/);
          if (!m) continue;
          const k = Number(m[2]);
          if (m[1] === "S") { cur = k; started = true; curStart = Date.now(); partial = ""; arm(); continue; }
          let actual = null, error;
          try { actual = JSON.parse(m[3]); } catch { error = "结果没法解析"; }
          if (actual && typeof actual === "object" && !Array.isArray(actual) && "__error" in actual) { error = String(actual.__error); actual = null; }
          results[k] = { index: k, actual, stdout: clip(partial), ...(error ? { error } : {}), duration: Date.now() - curStart };
          cur = -1; partial = "";
          clearTimeout(timer);
          timer = setTimeout(() => { timedOut = true; killTree(child); }, caseMs);
        }
      };
      child.stdout.on("data", (b) => {
        bytes += b.length;
        if (bytes > PROC_OUT) { overflow = true; killTree(child); return; }
        buf += dec.write(b);
        parse();
      });
      child.stderr.on("data", (b) => { err = (err + b.toString("utf8")).slice(-(64 << 10)); });
      const finish = (code, signal, extra) => {
        if (done) return; done = true; clearTimeout(timer);
        buf += dec.end(); parse();
        if (cur >= 0) partial += buf;
        resolve({ cur, started, caseTimedOut, timedOut, overflow, code, signal, stderr: err + (extra || ""), partial, caseMs: Date.now() - curStart });
      };
      child.on("error", (e) => finish(-1, null, String(e.message || e)));
      child.on("close", (code, signal) => finish(code, signal));
    });
  }
}

module.exports = { run, runMarked, clip, killTree, CASE_OUT };
