#!/usr/bin/env node
"use strict";
// 远端运行器的沙箱入口：在一次性的容器里运行（服务端 docker exec -i <容器> node sandbox.js），用完整个容器就删掉。
// 从标准输入读一个任务，编译、逐组运行（或调试一组），结果写到标准输出：
//   任务 { lang, mode: "leetcode" | "acm", code, sig, cases: [{ input?, stdin? }], debug?, limits?: { caseMs, totalMs, steps } }
//   结果 { ok: true, compileMs, runMs, compileError?, results: [{ index, actual, stdout, stderr?, error?, duration, trace? }] }
// 结果的格式和网站浏览器里运行的一样（site/lib/practice/types.ts），比对答案在浏览器里做。
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { LANG_IDS, leetcodeProgram, acmProgram } = require("./programs");
const { compile, crashMessage, mapLines, PREP, exists } = require("./toolchain");
const { run, runMarked, clip } = require("./exec");

const WORK = process.env.RUNNER_WORK || "/work";
const DEBUG_LANGS = ["java", "cpp", "go"];
const STEP_LIMIT_MSG = (n) => `调试最多记录 ${n} 步，程序停在了这里（没有运行完）。可以换一组小一点的输入再调试`;

function readStdin() {
  return new Promise((resolve) => {
    const parts = [];
    process.stdin.on("data", (b) => parts.push(b));
    process.stdin.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
  });
}

function check(job) {
  if (!job || typeof job !== "object") throw new Error("任务格式不对");
  if (!LANG_IDS.includes(job.lang)) throw new Error("不支持的语言：" + job.lang);
  if (job.mode !== "leetcode" && job.mode !== "acm") throw new Error("模式只能是 leetcode 或 acm");
  if (typeof job.code !== "string" || job.code.length > 100000) throw new Error("代码不能超过 100 KB");
  if (!Array.isArray(job.cases) || !job.cases.length || job.cases.length > 100) throw new Error("用例要有 1 到 100 组");
  if (job.mode === "leetcode" && (!job.sig || typeof job.sig !== "object")) throw new Error("力扣模式要有函数签名");
  if (job.mode === "leetcode" && job.cases.some((c) => !Array.isArray(c.input))) throw new Error("力扣模式的用例要有 input");
  if (job.debug && !DEBUG_LANGS.includes(job.lang)) throw new Error("这门语言在浏览器里调试，不用云端");
  if (job.debug && job.cases.length !== 1) throw new Error("调试一次只跑一组用例");
}

async function main() {
  let job;
  try {
    job = JSON.parse(await readStdin());
    check(job);
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
  const limits = { caseMs: 3000, totalMs: 30000, steps: 1000, ...(job.limits || {}) };
  const dir = path.join(WORK, "job-" + crypto.randomBytes(6).toString("hex"));
  fs.mkdirSync(dir, { recursive: true });
  try {
    const prog = job.mode === "acm" ? acmProgram(job) : leetcodeProgram(job);
    const built = await compile(job.lang, prog, dir, { debug: !!job.debug, acm: job.mode === "acm" });
    if (!built.ok) {
      return { ok: true, compileMs: built.ms, compileError: built.error, results: job.cases.map((_, index) => ({ index, actual: null, stdout: "", error: "编译出错：\n" + built.error, duration: 0 })) };
    }
    const t0 = Date.now();
    const results = job.debug ? [await debugCase(job, prog, built, dir, limits)]
      : job.mode === "acm" ? await acmCases(job, prog, built, dir, limits)
        : await runMarked({ file: built.cmd.file, args: built.cmd.args, cwd: dir, env: built.cmd.env, n: job.cases.length, caseMs: limits.caseMs, totalMs: limits.totalMs, tok: crypto.randomBytes(8).toString("hex"), describe: crashMessage(job.lang, prog) });
    return { ok: true, compileMs: built.ms, runMs: Date.now() - t0, results };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** ACM 模式：每组单独运行一次程序，标准输入就是用例 */
async function acmCases(job, prog, built, dir, limits) {
  const out = [], t0 = Date.now(), describe = crashMessage(job.lang, prog);
  for (let index = 0; index < job.cases.length; index++) {
    if (Date.now() - t0 > limits.totalMs) { out.push({ index, actual: null, stdout: "", error: "这次运行的总时间用完了，这一组没有运行", duration: 0 }); continue; }
    const r = await run(built.cmd.file, built.cmd.args(0, ""), { cwd: dir, env: built.cmd.env, input: String(job.cases[index].stdin || ""), timeoutMs: limits.caseMs, maxOut: 1 << 20 });
    const res = { index, actual: null, stdout: clip(r.stdout), duration: r.ms };
    const stderr = mapLines(r.stderr, prog).trim();
    if (stderr) res.stderr = clip(stderr, 4000);
    if (r.timedOut) res.error = `超时：这一组运行超过 ${limits.caseMs / 1000} 秒（检查是不是死循环，或者复杂度太高）`;
    else if (r.overflow) res.error = "输出太多了（超过 1 MB）";
    else if (r.code !== 0 || r.signal) res.error = describe(r);
    out.push(res);
  }
  return out;
}

/** 调试一组：在真调试器下跑，记下每一步（Java 用 JDI，C++ 用 gdb，Go 用 dlv） */
async function debugCase(job, prog, built, dir, limits) {
  const tok = crypto.randomBytes(8).toString("hex");
  const acm = job.mode === "acm";
  const files = { stdin: path.join(dir, "dbg.in"), stdout: path.join(dir, "dbg.out"), stderr: path.join(dir, "dbg.err"), trace: path.join(dir, "dbg.trace.json") };
  fs.writeFileSync(files.stdin, acm ? String(job.cases[0].stdin || "") : "");
  // 力扣模式的程序一开始会写一个「第 0 组开始」的标记，记录里的输出长度要去掉它
  const outSkip = acm ? 0 : ("\x01" + tok + ":S:0\x02").length;
  const args = acm ? [] : [...prog.args(0, tok), ...(job.lang === "cpp" ? ["debug"] : [])];
  const t0 = Date.now(), wallMs = Math.max(20000, limits.caseMs * 5);
  let trace = null, failure = null;

  if (job.lang === "cpp") {
    const cfg = path.join(dir, "dbg.cfg.json");
    fs.writeFileSync(cfg, JSON.stringify({ exe: built.cmd.exe, args, src: path.join(dir, prog.user), off: prog.off, n: prog.n, limit: limits.steps, outSkip, ...files }));
    const r = await run("gdb", ["-q", "-nx", "-batch", "-x", path.join(__dirname, "trace", "gdb_trace.py")], { cwd: dir, env: { ...process.env, TRACE_CFG: cfg }, timeoutMs: wallMs });
    if (r.timedOut) failure = "调试超时";
    else if (!exists(files.trace)) failure = "调试器没有正常结束：" + (r.stderr || r.stdout).trim().split("\n").slice(-5).join("\n");
  } else if (job.lang === "java") {
    const jdi = path.join(PREP, "jdi");
    const cp = exists(path.join(jdi, "JdiTrace.class")) ? jdi : await buildJdi(dir);
    const r = await run("java", ["-cp", cp, "JdiTrace", files.trace, files.stdin, files.stdout, files.stderr, prog.user, String(prog.off), String(prog.n), String(limits.steps), String(outSkip), built.cmd.classpath, built.cmd.main, ...args], { cwd: dir, timeoutMs: wallMs });
    if (r.timedOut) failure = "调试超时";
    else if (!exists(files.trace)) failure = "调试器没有正常结束：" + (r.stderr || r.stdout).trim().split("\n").slice(-5).join("\n");
  } else if (job.lang === "go") {
    const { traceGo } = require("./trace/dlv");
    const r = await traceGo({ exe: built.cmd.exe, args, cwd: dir, ...files, user: prog.user, off: prog.off, n: prog.n, limit: limits.steps, outSkip, timeoutMs: wallMs });
    if (r.timedOut) failure = "调试超时";
    else if (r.error) failure = "调试器出错：" + r.error;
    trace = r.trace;
  }
  if (!trace && exists(files.trace)) {
    try { trace = JSON.parse(fs.readFileSync(files.trace, "utf8")); } catch { failure = failure || "调试记录没法读"; }
  }
  const raw = exists(files.stdout) ? fs.readFileSync(files.stdout, "utf8") : "";
  const stderr = exists(files.stderr) ? mapLines(fs.readFileSync(files.stderr, "utf8"), prog).trim() : "";
  const res = { index: 0, actual: null, stdout: "", duration: Date.now() - t0 };
  if (acm) res.stdout = clip(raw);
  else {
    // 拆出这一组的输出和结果（和 runMarked 同一套标记）
    const head = "\x01" + tok + ":";
    const s = raw.indexOf(head + "S:0\x02"), from = s < 0 ? 0 : s + (head + "S:0\x02").length;
    const r = raw.indexOf(head + "R:0:", from);
    res.stdout = clip(raw.slice(from, r < 0 ? undefined : r));
    if (r >= 0) {
      const body = raw.slice(r + (head + "R:0:").length, raw.indexOf("\x02", r));
      try {
        const v = JSON.parse(body);
        if (v && typeof v === "object" && !Array.isArray(v) && "__error" in v) res.error = String(v.__error); else res.actual = v;
      } catch { res.error = "结果没法解析"; }
    }
  }
  if (stderr) res.stderr = clip(stderr, 4000);
  if (trace) {
    res.trace = { steps: trace.steps || [], truncated: !!trace.truncated, limit: trace.limit || limits.steps };
    if (trace.truncated) res.error = STEP_LIMIT_MSG(res.trace.limit);
  }
  if (failure) res.error = failure;
  else if (!res.error && !acm && res.actual === null && !raw.includes("\x01" + tok + ":R:0:")) {
    res.error = trace && trace.signal ? `程序崩溃了（${trace.signal}）` : "程序没有跑完" + (stderr ? "\n" + stderr.split("\n").slice(-6).join("\n") : "");
  }
  return res;
}

/** 本机开发时没有预编译好的 JdiTrace：现编一份 */
async function buildJdi(dir) {
  const out = path.join(dir, "jdi");
  await run("javac", ["-encoding", "UTF-8", "-d", out, path.join(__dirname, "trace", "JdiTrace.java")], { timeoutMs: 60000 });
  return out;
}

main().then((res) => {
  process.stdout.write(JSON.stringify(res));
}, (e) => {
  process.stdout.write(JSON.stringify({ ok: false, error: "沙箱出错：" + String((e && e.stack) || e).slice(0, 2000) }));
});
