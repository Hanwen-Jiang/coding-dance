"use strict";
// 各语言怎么编译、怎么运行、崩溃了怎么说。
// 容器里的工具链和预编译好的东西（C++ 预编译头、Go 标准库的归档、Java 调试器）由 prepare.js 在构建镜像时放进 RUNNER_PREPARED；
// 本机开发（没有这个目录）时直接用 PATH 里的工具，慢一些但结果一样。
const fs = require("fs"), path = require("path");
const { run } = require("./exec");
const { JUDGE } = require("./programs");

const WIN = process.platform === "win32", EXE = WIN ? ".exe" : "";
const PREP = process.env.RUNNER_PREPARED || "/opt/lc/prepared";
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const PY = (process.env.PYTHON || (WIN ? "python" : "python3")).split(" ");

/** C++：运行用的开地址检查和未定义行为检查（和力扣一样会报越界、溢出），调试用的不优化 */
const CPP_FLAGS = {
  run: ["-std=c++20", "-O1", "-g", "-w", "-D_GLIBCXX_ASSERTIONS", "-fsanitize=address,undefined", "-fno-sanitize-recover=all", "-fno-omit-frame-pointer"],
  debug: ["-std=c++20", "-O0", "-g", "-w"],
};
const SAN_ENV = {
  ASAN_OPTIONS: "detect_leaks=0:quarantine_size_mb=16:malloc_context_size=5:allocator_may_return_null=1:print_summary=1",
  UBSAN_OPTIONS: "print_stacktrace=1:halt_on_error=1",
};
const JAVA_FLAGS = ["-Xss64m", "-Xmx512m", "-XX:+UseSerialGC", "-XX:-UsePerfData", "-Dfile.encoding=UTF-8", "-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8"];
const nodeMajor = Number(process.versions.node.split(".")[0]);
const NODE_FLAGS = ["--stack-size=4000", "--max-old-space-size=512", "--no-warnings", ...(nodeMajor < 23 ? ["--experimental-strip-types"] : [])];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 输出里的「文件:行号」换成编辑器里的行号；落在判题程序里的标出来 */
function mapLines(text, prog) {
  const f = escapeRe(prog.user);
  const at = (l) => { const n = Number(l) - prog.off; return n >= 1 && n <= prog.n ? n : null; };
  return String(text || "")
    .replace(new RegExp(`File "(?:[^"]*[\\\\/])?${f}", line (\\d+)`, "g"), (all, l) => (at(l) ? `第 ${at(l)} 行` : "（判题程序）"))
    .replace(new RegExp(`(?:[\\w.~-]*[\\\\/])*${f}:(\\d+)(?::(\\d+))?`, "g"), (all, l, c) => (at(l) ? `第 ${at(l)} 行${c ? `第 ${c} 列` : ""}` : `（判题程序第 ${l} 行）`));
}

/** 编译器的报错：行号换好，去掉颜色和太长的部分 */
function compileMessage(text, prog) {
  const out = [];
  for (let line of mapLines(text, prog).replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/)) {
    // g++ 的源码摘录「   12 |   int x」里的行号也换掉
    line = line.replace(/^(\s*)(\d+)( \| )/, (all, sp, l, bar) => { const n = Number(l) - prog.off; return n >= 1 && n <= prog.n ? `${sp}${n}${bar}` : all; });
    if (/^\s*$/.test(line) || /^In file included from|^\s+from |: In (member )?function|: At global scope|^Note: /.test(line)) continue;
    out.push(line);
    if (out.length >= 40) { out.push("…"); break; }
  }
  return out.join("\n").trim() || "编译没有通过";
}

const tail = (s, n = 12) => s.trim().split(/\r?\n/).slice(-n).join("\n");

/** 进程在某一组中途死了：说成人话 */
function crashMessage(lang, prog) {
  return (r) => {
    const err = mapLines(r.stderr, prog).trim();
    const more = err ? "\n" + tail(err) : "";
    if (lang === "cpp") {
      const ub = err.match(/(第 \d+ 行[^:\n]*): runtime error: ([^\n]+)/);
      if (ub) return `运行错误（${ub[1]}）：${ub[2]}`;
      const asan = err.match(/ERROR: AddressSanitizer: ([\w-]+)/);
      if (asan) {
        const where = (err.slice(err.indexOf(asan[0])).match(/第 \d+ 行/) || [""])[0];
        const what = { "heap-buffer-overflow": "数组越界（堆上）", "stack-buffer-overflow": "数组越界（栈上）", "heap-use-after-free": "用了已经释放的内存", "stack-overflow": "递归太深（栈溢出）", SEGV: "访问了空指针或非法地址", "global-buffer-overflow": "数组越界（全局变量）", "stack-use-after-return": "用了已经返回的函数里的变量" }[asan[1]] || asan[1];
        return `运行错误${where ? `（${where}）` : ""}：${what}（AddressSanitizer: ${asan[1]}）`;
      }
      const assert = err.match(/Assertion '([^']+)' failed/);
      if (assert) return `运行错误：下标越界（${assert[1]}）` + more;
    }
    if (lang === "go") {
      if (/goroutine stack exceeds/.test(err)) return "递归太深（栈溢出）";
      const fatal = err.match(/^fatal error: ([^\n]+)/m);
      if (fatal) return "运行错误：" + fatal[1] + more;
    }
    if (lang === "java" && /OutOfMemoryError/.test(err)) return "内存超出限制（java.lang.OutOfMemoryError）";
    if (lang === "python" && /MemoryError/.test(err)) return "内存超出限制（MemoryError）";
    if (r.signal === "SIGKILL") return "程序被系统停下了（多半是内存超出限制）" + more;
    if (r.signal === "SIGSEGV" || r.code === 139) return "段错误：访问了空指针、越界，或者递归太深" + more;
    if (r.signal === "SIGABRT" || r.code === 134) return "程序中止（abort）" + more;
    if (r.signal === "SIGFPE") return "算术错误（比如除以 0）" + more;
    if (r.code) return `程序异常退出（退出码 ${r.code}）` + more;
    return "程序提前结束了" + more;
  };
}

/** 写文件 */
function writeFiles(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
}

/** Go 的预编译标准库（prepare.js 生成）：有就直接调编译器和链接器，不用 go build（容器里的文件系统是只读的，也不能写缓存） */
function goPrepared() {
  const cfg = path.join(PREP, "go", "importcfg"), tools = path.join(PREP, "go", "tooldir.txt");
  return exists(cfg) && exists(tools) ? { cfg, tooldir: fs.readFileSync(tools, "utf8").trim() } : null;
}

/**
 * 编译。返回 { ok, ms, error?, cmd: { file, args(from, tok), env } }。
 * debug：调试用的构建（不优化、带调试信息）；acm：ACM 模式的完整程序。
 */
async function compile(lang, prog, dir, { debug = false, acm = false, timeoutMs = 60000 } = {}) {
  writeFiles(dir, prog.files);
  const t0 = Date.now();
  const done = (cmd) => ({ ok: true, ms: Date.now() - t0, cmd });
  const fail = (text, map = prog) => ({ ok: false, ms: Date.now() - t0, error: compileMessage(text, map) });
  const timeout = "编译超时（超过 60 秒）";

  if (lang === "python") {
    // 只检查用户的代码（solution.py），行号就是编辑器里的
    const r = await run(PY[0], [...PY.slice(1), "-X", "utf8", "-m", "py_compile", "solution.py"], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr.replace(/^Sorry: /m, ""), { user: "solution.py", off: 0, n: prog.n });
    return done({ file: PY[0], args: (from, tok) => [...PY.slice(1), "-X", "utf8", ...prog.args(from, tok)] });
  }
  if (lang === "javascript" || lang === "typescript") {
    if (lang === "javascript") {
      const r = await run(process.execPath, ["--check", prog.user], { cwd: dir, timeoutMs });
      if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr);
    }
    return done({ file: process.execPath, args: (from, tok) => [...NODE_FLAGS, ...prog.args(from, tok)] });
  }
  if (lang === "java") {
    const r = await run("javac", ["-J-Duser.language=zh", "-J-Duser.country=CN", "-encoding", "UTF-8", "-proc:none", "-nowarn", "-Xlint:none", "-g", "-d", "out", prog.user], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr + r.stdout);
    return done({ file: "java", args: (from, tok) => [...JAVA_FLAGS, "-cp", "out", prog.main, ...prog.args(from, tok)], classpath: path.join(dir, "out"), main: prog.main });
  }
  if (lang === "cpp") {
    const variant = debug ? "debug" : "run";
    const inc = acm ? (exists(path.join(PREP, "cpp", "acm", "bits")) && !debug ? ["-I", path.join(PREP, "cpp", "acm")] : [])
      : exists(path.join(PREP, "cpp", variant, "prelude.h")) ? ["-I", path.join(PREP, "cpp", variant)] : ["-I", path.join(JUDGE, "prelude")];
    const exe = "prog" + EXE;
    const r = await run("g++", [...CPP_FLAGS[variant], "-fdiagnostics-color=never", ...inc, "-o", exe, prog.user], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr);
    return done({ file: path.join(dir, exe), args: (from, tok) => prog.args(from, tok), env: { ...process.env, ...(debug ? {} : SAN_ENV) }, exe: path.join(dir, exe) });
  }
  if (lang === "go") {
    const exe = path.join(dir, "prog" + EXE), files = Object.keys(prog.files).filter((f) => f.endsWith(".go"));
    const gp = goPrepared();
    if (gp) {
      const c = await run(path.join(gp.tooldir, "compile"), ["-p", "main", "-complete", "-importcfg", gp.cfg, "-o", "main.a", ...(debug ? ["-N", "-l"] : []), ...files], { cwd: dir, timeoutMs });
      if (c.code !== 0) return fail(c.timedOut ? timeout : c.stdout + c.stderr);
      const l = await run(path.join(gp.tooldir, "link"), ["-importcfg", gp.cfg, "-o", exe, "main.a"], { cwd: dir, timeoutMs });
      if (l.code !== 0) return fail(l.timedOut ? timeout : l.stdout + l.stderr);
    } else {
      fs.writeFileSync(path.join(dir, "go.mod"), "module practice\n\ngo 1.21\n");
      const r = await run("go", ["build", "-o", exe, ...(debug ? ["-gcflags=all=-N -l"] : []), "."], { cwd: dir, timeoutMs });
      if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr.split("\n").filter((x) => !x.startsWith("#")).join("\n"));
    }
    return done({ file: exe, args: (from, tok) => prog.args(from, tok), exe });
  }
  throw new Error("不支持的语言：" + lang);
}

module.exports = { compile, crashMessage, mapLines, compileMessage, PREP, exists, PY, CPP_FLAGS, JAVA_FLAGS, WIN, EXE };
