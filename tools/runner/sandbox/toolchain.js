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
  const f = escapeRe(prog.user), dir = "(?:[\\w.~-]*[\\\\/])*";
  const at = (l) => { const n = Number(l) - prog.off; return n >= 1 && n <= prog.n ? n : null; };
  const here = (l, c) => (at(l) ? `第 ${at(l)} 行${c ? `第 ${c} 列` : ""}` : `（判题程序第 ${l} 行）`);
  let out = String(text || "")
    .replace(new RegExp(`File "(?:[^"]*[\\\\/])?${f}", line (\\d+)`, "g"), (all, l) => (at(l) ? `第 ${at(l)} 行` : "（判题程序）"))
    // C#：sol.cs(3,18)、sol.cs:line 3；PHP：main.php on line 3、main.php(3)
    .replace(new RegExp(`${dir}${f}\\((\\d+),(\\d+)\\)`, "g"), (all, l, c) => here(l, c))
    .replace(new RegExp(`${dir}${f}:line (\\d+)`, "g"), (all, l) => here(l))
    .replace(new RegExp(`(?:in )?${dir}${f} on line (\\d+)`, "g"), (all, l) => here(l))
    .replace(new RegExp(`${dir}${f}\\((\\d+)\\)`, "g"), (all, l) => here(l))
    .replace(new RegExp(`${dir}${f}:(\\d+)(?::(\\d+))?`, "g"), (all, l, c) => here(l, c));
  // 判题程序自己的文件（C#、Kotlin、Scala、Swift 的前置代码和入口）
  for (const h of prog.harness || []) out = out.replace(new RegExp(`${dir}${escapeRe(h)}(?::\\d+(?::\\d+)?|\\(\\d+(?:,\\d+)?\\)|:line \\d+)?`, "g"), "（判题程序）");
  return out;
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
    if (lang === "cpp" || lang === "c") {
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
    if (lang === "swift") {
      // Swift 的越界、强制解包 nil、整数溢出都是直接崩溃：「…: Fatal error: Index out of range」
      const fatal = err.match(/Fatal error: ([^\n]*)/);
      const where = (err.match(/第 \d+ 行/) || [""])[0];
      if (fatal) return `运行错误${where ? `（${where}）` : ""}：${fatal[1] || "Fatal error"}`;
      if (/Stack overflow|stack overflow/.test(err)) return "递归太深（栈溢出）";
    }
    if (lang === "rust" && /has overflowed its stack/.test(err)) return "递归太深（栈溢出）";
    if (lang === "csharp") {
      if (/Stack overflow/.test(err)) return "递归太深（栈溢出）";
      if (/OutOfMemoryException/.test(err)) return "内存超出限制（OutOfMemoryException）";
    }
    if (lang === "php" && /Allowed memory size of/.test(err)) return "内存超出限制（PHP memory_limit）";
    if ((lang === "java" || lang === "kotlin" || lang === "scala") && /OutOfMemoryError/.test(err)) return "内存超出限制（java.lang.OutOfMemoryError）";
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
  const ext = (e) => Object.keys(prog.files).filter((f) => f.endsWith(e));
  const exe = path.join(dir, "prog" + EXE);
  const native = () => done({ file: exe, args: (from, tok) => prog.args(from, tok), exe });
  if (lang === "c") {
    const r = await run("gcc", [...C_FLAGS, "-fdiagnostics-color=never", "-o", exe, prog.user, "-lm"], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr);
    return done({ file: exe, args: (from, tok) => prog.args(from, tok), env: { ...process.env, ...SAN_ENV }, exe });
  }
  if (lang === "csharp") {
    const cs = csharpTools();
    if (!cs) return fail("这台运行器上没有装 .NET SDK");
    const r = await run("dotnet", [cs.csc, "-nologo", "-noconfig", "-target:exe", "-langversion:latest", "-nullable:disable", "-optimize+", "-debug:portable", "-unsafe+", "-warn:0", "-out:prog.dll", ...(prog.main ? [`-main:${prog.main}`] : []), `@${cs.rsp}`, ...ext(".cs")], { cwd: dir, timeoutMs, env: DOTNET_ENV });
    if (r.code !== 0) return fail(r.timedOut ? timeout : r.stdout + r.stderr);
    fs.writeFileSync(path.join(dir, "prog.runtimeconfig.json"), JSON.stringify({ runtimeOptions: { tfm: "net8.0", framework: { name: "Microsoft.NETCore.App", version: cs.runtime }, configProperties: { "System.Globalization.Invariant": true } } }));
    return done({ file: "dotnet", args: (from, tok) => [path.join(dir, "prog.dll"), ...prog.args(from, tok)], env: DOTNET_ENV });
  }
  if (lang === "kotlin" || lang === "scala") {
    const k = lang === "kotlin";
    const home = k ? KOTLIN_HOME : SCALA_HOME, jsa = path.join(PREP, lang, "compiler.jsa");
    const cds = exists(jsa) ? [`-XX:SharedArchiveFile=${jsa}`] : [];
    const out = path.join(dir, "out");
    fs.mkdirSync(out, { recursive: true });
    const r = await run("java", [...JVM_COMPILE, ...cds, ...(k ? kotlincArgs(home) : scalacArgs(home)), "-d", out, ...ext(k ? ".kt" : ".scala")], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : (r.stderr + r.stdout).replace(/^warning: .*\n?/gm, ""));
    const lib = k ? path.join(home, "lib", "kotlin-stdlib.jar") : path.join(home, "lib", "scala-library.jar");
    return done({ file: "java", args: (from, tok) => [...JAVA_FLAGS, "-cp", out + path.delimiter + lib, prog.main, ...prog.args(from, tok)] });
  }
  if (lang === "swift") {
    const r = await run("swiftc", [...SWIFT_FLAGS, "-module-cache-path", path.join(dir, "mc"), "-o", exe, ...ext(".swift")], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr + r.stdout);
    return done({ file: exe, args: (from, tok) => prog.args(from, tok), env: SWIFT_ENV, exe });
  }
  if (lang === "rust") {
    const r = await run("rustc", ["--edition", "2021", "-O", "-A", "warnings", "--color", "never", "-o", exe, prog.user], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr);
    return native();
  }
  if (lang === "dart") {
    // 编成 kernel 用 JIT 跑：比 AOT（dart compile exe）编得快，出错时的调用栈也带行号（AOT 的不带）
    const dill = path.join(dir, "prog.dill"), env = { ...process.env, DART_SUPPRESS_ANALYTICS: "true" };
    const r = await run("dart", ["compile", "kernel", "--verbosity", "error", "-o", dill, prog.user], { cwd: dir, timeoutMs, env });
    if (r.code !== 0) return fail(r.timedOut ? timeout : (r.stdout + r.stderr).replace(/^Compiling .* to kernel file .*$/m, ""));
    return done({ file: "dart", args: (from, tok) => [dill, ...prog.args(from, tok)], env });
  }
  if (lang === "ruby") {
    const r = await run("ruby", ["-c", prog.user], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : r.stderr + r.stdout);
    return done({ file: "ruby", args: (from, tok) => ["-E", "UTF-8:UTF-8", "-W0", ...prog.args(from, tok)], env: RUBY_ENV });
  }
  if (lang === "php") {
    const r = await run("php", ["-l", "-d", "display_errors=stdout", prog.user], { cwd: dir, timeoutMs });
    if (r.code !== 0) return fail(r.timedOut ? timeout : (r.stdout + r.stderr).replace(/^Errors parsing .*$/m, "").replace(/^PHP /gm, ""));
    return done({ file: "php", args: (from, tok) => [...PHP_FLAGS, ...prog.args(from, tok)] });
  }
  throw new Error("不支持的语言：" + lang);
}

// —— 后加的九种语言（只在云端运行）用到的工具和参数 ——
/** C：和 C++ 一样开地址检查和未定义行为检查 */
const C_FLAGS = ["-std=gnu17", "-O1", "-g", "-w", "-fsanitize=address,undefined", "-fno-sanitize-recover=all", "-fno-omit-frame-pointer"];
/**
 * Swift：-O 时越界、强制解包 nil 只会直接崩溃（ud2），不说原因也没有行号；加 -assert-config Debug 有了原因，
 * 但内联之后调用栈从断言那里就断了（实测）。练习的用例都很小，用 -Onone -g：「Fatal error: Index out of range」和行号都有（SWIFT_BACKTRACE）
 */
const SWIFT_FLAGS = ["-Onone", "-g", "-suppress-warnings", "-module-name", "Solution"];
const SWIFT_ENV = { ...process.env, SWIFT_BACKTRACE: "enable=yes,interactive=no,color=no,registers=none,images=none,limit=12,threads=crashed,sanitize=yes" };
const KOTLIN_HOME = process.env.KOTLIN_HOME || "/opt/kotlinc";
const SCALA_HOME = process.env.SCALA_HOME || "/opt/scala";
/** 编译器跑在 JVM 上：只用 C1（短进程快得多）；prepare.js 做好的类数据共享归档（CDS）再省一半时间 */
const JVM_COMPILE = ["-Xss16m", "-Xmx512m", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-XX:-UsePerfData", "-Xshare:auto", "-Xlog:cds=off", "-Xlog:cds+dynamic=off", "-Dfile.encoding=UTF-8"];
const kotlincArgs = (home) => ["-cp", path.join(home, "lib", "kotlin-compiler.jar"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect", "-classpath", path.join(home, "lib", "kotlin-stdlib.jar"), "-nowarn"];
const scalacArgs = (home) => ["-cp", ["scala-compiler.jar", "scala-library.jar", "scala-reflect.jar"].map((j) => path.join(home, "lib", j)).join(path.delimiter), "scala.tools.nsc.Main", "-usejavacp", "-nowarn"];
/**
 * .NET：W^X（代码页双重映射）要建一个很大的内存文件，碰上沙箱的单个文件上限（ulimit fsize 128 MB）就被 SIGXFSZ 杀掉，关掉它；
 * 堆上限 512 MB，用多了是 OutOfMemoryException 而不是整台机器被杀
 */
const DOTNET_ENV = { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1", DOTNET_EnableWriteXorExecute: "0", DOTNET_GCHeapHardLimit: "0x20000000" };
/** Ruby 的线程栈（判题程序在线程里跑用例，递归深的题解要大一点） */
const RUBY_ENV = { ...process.env, RUBY_THREAD_VM_STACK_SIZE: String(128 << 20), RUBY_THREAD_MACHINE_STACK_SIZE: String(128 << 20) };
const PHP_FLAGS = ["-d", "display_errors=stderr", "-d", "log_errors=0", "-d", "memory_limit=512M", "-d", "error_reporting=E_ALL"];

/** C#：Roslyn 编译器（csc.dll）和引用程序集的响应文件；prepare.js 在镜像里做好，本机开发时现找 */
let csCache;
function csharpTools() {
  if (csCache !== undefined) return csCache;
  const prep = path.join(PREP, "csharp", "tools.json");
  if (exists(prep)) return (csCache = JSON.parse(fs.readFileSync(prep, "utf8")));
  csCache = findCsharp(path.join(require("os").tmpdir(), "lc-csharp-refs.rsp"));
  return csCache;
}
/** 找 .NET SDK 里的 csc.dll 和引用程序集，写好响应文件（-r:每一个 dll） */
function findCsharp(rsp) {
  const roots = [process.env.DOTNET_ROOT, "/usr/lib/dotnet", "/usr/share/dotnet", "/usr/local/share/dotnet"].filter(Boolean);
  const newest = (d) => (exists(d) ? fs.readdirSync(d).filter((v) => /^\d+\.\d+\.\d+/.test(v)).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).pop() : null);
  for (const root of roots) {
    const sdk = newest(path.join(root, "sdk")), ref = newest(path.join(root, "packs", "Microsoft.NETCore.App.Ref")), rt = newest(path.join(root, "shared", "Microsoft.NETCore.App"));
    if (!sdk || !ref || !rt) continue;
    const csc = path.join(root, "sdk", sdk, "Roslyn", "bincore", "csc.dll");
    const refDir = path.join(root, "packs", "Microsoft.NETCore.App.Ref", ref, "ref");
    const tfm = fs.readdirSync(refDir).find((d) => d.startsWith("net"));
    if (!exists(csc) || !tfm) continue;
    const dlls = fs.readdirSync(path.join(refDir, tfm)).filter((f) => f.endsWith(".dll")).map((f) => `-r:"${path.join(refDir, tfm, f)}"`);
    fs.mkdirSync(path.dirname(rsp), { recursive: true });
    fs.writeFileSync(rsp, dlls.join("\n") + "\n");
    return { csc, rsp, runtime: rt };
  }
  return null;
}

module.exports = { compile, crashMessage, mapLines, compileMessage, PREP, exists, PY, CPP_FLAGS, JAVA_FLAGS, WIN, EXE, C_FLAGS, SWIFT_FLAGS, JVM_COMPILE, KOTLIN_HOME, SCALA_HOME, kotlincArgs, scalacArgs, findCsharp };
