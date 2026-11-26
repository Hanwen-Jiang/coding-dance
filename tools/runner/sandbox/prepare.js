#!/usr/bin/env node
"use strict";
// 构建镜像时运行一次（Dockerfile 里），把每次运行都要用、又很慢的东西提前做好，放进 RUNNER_PREPARED：
//   cpp/run、cpp/debug：判题前置代码 prelude.h 的预编译头（运行用的开了 AddressSanitizer，调试用的不优化）
//   cpp/acm：<bits/stdc++.h> 的预编译头（ACM 模式）
//   go：标准库编好的归档和 importcfg，运行时直接调编译器和链接器（容器的文件系统是只读的，不能用 go build 的缓存）
//   jdi：Java 调试器 JdiTrace
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { CPP_FLAGS } = require("./toolchain");
const { JUDGE } = require("./programs");

const PREP = process.env.RUNNER_PREPARED || "/opt/lc/prepared";
const sh = (cmd, args, opts = {}) => {
  const r = cp.spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 失败：\n${r.stderr || r.stdout || r.error}`);
  return r;
};
const step = (name, fn) => { const t = Date.now(); fn(); console.log(`✓ ${name}（${((Date.now() - t) / 1000).toFixed(1)} 秒）`); };

step("C++ 预编译头", () => {
  for (const variant of ["run", "debug"]) {
    const dir = path.join(PREP, "cpp", variant);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(JUDGE, "prelude", "prelude.h"), path.join(dir, "prelude.h"));
    sh("g++", [...CPP_FLAGS[variant], "-x", "c++-header", path.join(dir, "prelude.h"), "-o", path.join(dir, "prelude.h.gch")]);
    // 确认真的用上了预编译头（-H 会把用上的 .gch 标成 !）
    const t = path.join(dir, "check.cpp");
    fs.writeFileSync(t, '#include "prelude.h"\nint main() { return 0; }\n');
    const r = cp.spawnSync("g++", [...CPP_FLAGS[variant], "-Winvalid-pch", "-H", "-I", dir, "-fsyntax-only", t], { encoding: "utf8" });
    fs.rmSync(t);
    if (!/^! .*prelude\.h\.gch/m.test(r.stderr)) throw new Error(`prelude.h 的预编译头（${variant}）没有用上：\n${r.stderr.slice(0, 2000)}`);
  }
  // ACM：<bits/stdc++.h> 复制一份到我们的目录，旁边放预编译头；编译时 -I 这个目录排在系统目录前面
  const h = sh("g++", ["-std=c++20", "-x", "c++", "-E", "-H", "-", "-o", "/dev/null"], { input: "#include <bits/stdc++.h>\n" }).stderr.match(/^\. (\S*bits\/stdc\+\+\.h)$/m);
  if (!h) throw new Error("找不到 bits/stdc++.h");
  const dir = path.join(PREP, "cpp", "acm", "bits");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(h[1], path.join(dir, "stdc++.h"));
  sh("g++", [...CPP_FLAGS.run, "-x", "c++-header", path.join(dir, "stdc++.h"), "-o", path.join(dir, "stdc++.h.gch")]);
});

step("Go 标准库", () => {
  const dir = path.join(PREP, "go"), cache = path.join(dir, "cache");
  fs.mkdirSync(cache, { recursive: true });
  const env = { ...process.env, GOCACHE: cache, CGO_ENABLED: "0", GOFLAGS: "", GOPATH: "/tmp/gopath" };
  // 力扣 Go 环境自动导入的包、判题程序用的包，再加几个常用的
  const { PKGS } = require(path.join(JUDGE, "langs", "go")).parts;
  const pkgs = [...new Set([...PKGS.map(([, p]) => p), "encoding/json", "os", "runtime/debug", "bufio", "errors", "cmp", "unicode/utf8", "regexp", "time", "sync", "io", "math/big", "container/ring", "iter", "runtime"])];
  const list = sh("go", ["list", "-export", "-deps", "-f", "{{if .Export}}packagefile {{.ImportPath}}={{.Export}}{{end}}", ...pkgs], { env, cwd: "/tmp" }).stdout;
  fs.writeFileSync(path.join(dir, "importcfg"), list.trim() + "\n");
  fs.writeFileSync(path.join(dir, "tooldir.txt"), sh("go", ["env", "GOTOOLDIR"], { env }).stdout.trim());
  // 编一个小程序确认能用
  const t = fs.mkdtempSync("/tmp/gocheck-");
  fs.writeFileSync(path.join(t, "main.go"), 'package main\n\nimport (\n\t"fmt"\n\t"sort"\n)\n\nfunc main() {\n\ta := []int{3, 1, 2}\n\tsort.Ints(a)\n\tfmt.Println(a)\n}\n');
  const tools = fs.readFileSync(path.join(dir, "tooldir.txt"), "utf8").trim();
  sh(path.join(tools, "compile"), ["-p", "main", "-complete", "-importcfg", path.join(dir, "importcfg"), "-o", path.join(t, "main.a"), path.join(t, "main.go")]);
  sh(path.join(tools, "link"), ["-importcfg", path.join(dir, "importcfg"), "-o", path.join(t, "prog"), path.join(t, "main.a")]);
  if (sh(path.join(t, "prog"), []).stdout.trim() !== "[1 2 3]") throw new Error("Go 预编译标准库编出来的程序不对");
  fs.rmSync(t, { recursive: true, force: true });
});

step("Java 调试器", () => {
  sh("javac", ["-encoding", "UTF-8", "-d", path.join(PREP, "jdi"), path.join(__dirname, "trace", "JdiTrace.java")]);
});

// —— 后加的九种语言 ——
const T = require("./toolchain");
const { leetcodeProgram } = require("./programs");
/** 拼一个力扣模式的程序（102 层序遍历：树、列表、嵌套列表都用到），写进临时目录 */
const SAMPLE_SIG = { fn: "levelOrder", params: ["TreeNode"], ret: "List<List<int>>" };
const SAMPLE_CASES = [{ input: [[3, 9, 20, null, null, 15, 7]] }];
function sample(lang, code) {
  const dir = fs.mkdtempSync(`/tmp/prep-${lang}-`);
  const prog = leetcodeProgram({ lang, mode: "leetcode", code, sig: SAMPLE_SIG, cases: SAMPLE_CASES });
  for (const [name, text] of Object.entries(prog.files)) fs.writeFileSync(path.join(dir, name), text);
  return { dir, prog, files: (e) => Object.keys(prog.files).filter((f) => f.endsWith(e)) };
}
/** 跑一下编出来的程序，确认结果对（标记里的 R:0:… 就是结果） */
function expectRun(cmd, args, opts) {
  const out = sh(cmd, args, opts).stdout;
  if (!out.includes("R:0:[[3],[9,20],[15,7]]")) throw new Error(`${cmd} 跑出来的结果不对：${out.slice(0, 500)}`);
}

step("C# 编译器和引用程序集", () => {
  const dir = path.join(PREP, "csharp");
  fs.mkdirSync(dir, { recursive: true });
  const cs = T.findCsharp(path.join(dir, "refs.rsp"));
  if (!cs) throw new Error("找不到 .NET SDK（csc.dll、引用程序集）");
  fs.writeFileSync(path.join(dir, "tools.json"), JSON.stringify(cs));
  const s = sample("csharp", "public class Solution {\n    public IList<IList<int>> LevelOrder(TreeNode root) {\n        var res = new List<IList<int>>();\n        var q = new Queue<TreeNode>();\n        if (root != null) q.Enqueue(root);\n        while (q.Count > 0) {\n            var level = new List<int>();\n            for (int n = q.Count; n > 0; n--) { var t = q.Dequeue(); level.Add(t.val); if (t.left != null) q.Enqueue(t.left); if (t.right != null) q.Enqueue(t.right); }\n            res.Add(level);\n        }\n        return res;\n    }\n}\n");
  sh("dotnet", [cs.csc, "-nologo", "-noconfig", "-target:exe", "-langversion:latest", "-optimize+", "-debug:portable", "-warn:0", "-out:prog.dll", "-main:JudgeMain", `@${cs.rsp}`, ...s.files(".cs")], { cwd: s.dir });
  fs.writeFileSync(path.join(s.dir, "prog.runtimeconfig.json"), JSON.stringify({ runtimeOptions: { tfm: "net8.0", framework: { name: "Microsoft.NETCore.App", version: cs.runtime }, configProperties: { "System.Globalization.Invariant": true } } }));
  expectRun("dotnet", [path.join(s.dir, "prog.dll"), "0", "t"], { cwd: s.dir });
  fs.rmSync(s.dir, { recursive: true, force: true });
});

// Kotlin、Scala 的编译器跑在 JVM 上，冷启动要好几秒：编一个例子，把加载过的类存成 CDS 归档，之后每次编译直接映射进来（快一半）
const JVM_SAMPLES = {
  kotlin: "class Solution {\n    fun levelOrder(root: TreeNode?): List<List<Int>> {\n        val res = mutableListOf<List<Int>>()\n        val q = ArrayDeque<TreeNode>()\n        root?.let { q.addLast(it) }\n        while (q.isNotEmpty()) {\n            val level = ArrayList<Int>()\n            repeat(q.size) {\n                val t = q.removeFirst()\n                level.add(t.`val`)\n                t.left?.let { q.addLast(it) }\n                t.right?.let { q.addLast(it) }\n            }\n            res.add(level.sortedBy { 0 }.map { it }.toList())\n        }\n        val m = HashMap<Int, Int>(); m[1] = (m[1] ?: 0) + 1\n        return res\n    }\n}\n",
  scala: "object Solution {\n    def levelOrder(root: TreeNode): List[List[Int]] = {\n        val res = scala.collection.mutable.ListBuffer[List[Int]]()\n        val q = scala.collection.mutable.Queue[TreeNode]()\n        if (root != null) q.enqueue(root)\n        while (q.nonEmpty) {\n            val level = (0 until q.size).map { _ =>\n                val t = q.dequeue()\n                if (t.left != null) q.enqueue(t.left)\n                if (t.right != null) q.enqueue(t.right)\n                t.value\n            }\n            res += level.toList.sortBy(_ => 0)\n        }\n        val m = scala.collection.mutable.HashMap[Int, Int]().withDefaultValue(0); m(1) += 1\n        res.toList\n    }\n}\n",
};
for (const lang of ["kotlin", "scala"]) {
  step(`${lang === "kotlin" ? "Kotlin" : "Scala"} 编译器的 CDS 归档`, () => {
    const home = lang === "kotlin" ? T.KOTLIN_HOME : T.SCALA_HOME, args = lang === "kotlin" ? T.kotlincArgs(home) : T.scalacArgs(home);
    const jsa = path.join(PREP, lang, "compiler.jsa");
    fs.mkdirSync(path.dirname(jsa), { recursive: true });
    const s = sample(lang, JVM_SAMPLES[lang]);
    const out = path.join(s.dir, "out");
    fs.mkdirSync(out);
    sh("java", [...T.JVM_COMPILE, `-XX:ArchiveClassesAtExit=${jsa}`, ...args, "-d", out, ...s.files(lang === "kotlin" ? ".kt" : ".scala")], { cwd: s.dir });
    // 用归档再编一次、跑一下
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out);
    sh("java", [...T.JVM_COMPILE, `-XX:SharedArchiveFile=${jsa}`, ...args, "-d", out, ...s.files(lang === "kotlin" ? ".kt" : ".scala")], { cwd: s.dir });
    const lib = path.join(home, "lib", lang === "kotlin" ? "kotlin-stdlib.jar" : "scala-library.jar");
    expectRun("java", ["-cp", out + path.delimiter + lib, "JudgeMain", "0", "t"], { cwd: s.dir });
    fs.rmSync(s.dir, { recursive: true, force: true });
  });
}

step("Swift、Rust、Dart、C、Ruby、PHP 编一个例子试试", () => {
  const codes = {
    swift: "class Solution {\n    func levelOrder(_ root: TreeNode?) -> [[Int]] {\n        var res: [[Int]] = [], q: [TreeNode] = []\n        if let r = root { q.append(r) }\n        while !q.isEmpty {\n            res.append(q.map { $0.val })\n            q = q.flatMap { [$0.left, $0.right].compactMap { $0 } }\n        }\n        return res\n    }\n}\n",
    rust: "use std::rc::Rc;\nuse std::cell::RefCell;\nimpl Solution {\n    pub fn level_order(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<Vec<i32>> {\n        let mut res = vec![];\n        let mut q: Vec<Rc<RefCell<TreeNode>>> = root.into_iter().collect();\n        while !q.is_empty() {\n            res.push(q.iter().map(|t| t.borrow().val).collect());\n            q = q.iter().flat_map(|t| { let b = t.borrow(); vec![b.left.clone(), b.right.clone()] }).flatten().collect();\n        }\n        res\n    }\n}\n",
    dart: "class Solution {\n  List<List<int>> levelOrder(TreeNode? root) {\n    final res = <List<int>>[];\n    var q = <TreeNode>[if (root != null) root];\n    while (q.isNotEmpty) {\n      res.add([for (final t in q) t.val]);\n      q = [for (final t in q) ...[t.left, t.right].whereType<TreeNode>()];\n    }\n    return res;\n  }\n}\n",
    c: "int** levelOrder(struct TreeNode* root, int* returnSize, int** returnColumnSizes) {\n    struct TreeNode* q[2000];\n    int head = 0, tail = 0;\n    int** res = malloc(sizeof(int*) * 2000);\n    *returnColumnSizes = malloc(sizeof(int) * 2000);\n    *returnSize = 0;\n    if (root) q[tail++] = root;\n    while (head < tail) {\n        int n = tail - head;\n        res[*returnSize] = malloc(sizeof(int) * n);\n        (*returnColumnSizes)[*returnSize] = n;\n        for (int i = 0; i < n; i++) {\n            struct TreeNode* t = q[head++];\n            res[*returnSize][i] = t->val;\n            if (t->left) q[tail++] = t->left;\n            if (t->right) q[tail++] = t->right;\n        }\n        (*returnSize)++;\n    }\n    return res;\n}\n",
    ruby: "def level_order(root)\n  res = []\n  q = root ? [root] : []\n  until q.empty?\n    res << q.map(&:val)\n    q = q.flat_map { |t| [t.left, t.right].compact }\n  end\n  res\nend\n",
    php: "class Solution {\n    function levelOrder($root) {\n        $res = [];\n        $q = $root ? [$root] : [];\n        while ($q) {\n            $res[] = array_map(fn($t) => $t->val, $q);\n            $next = [];\n            foreach ($q as $t) { if ($t->left) $next[] = $t->left; if ($t->right) $next[] = $t->right; }\n            $q = $next;\n        }\n        return $res;\n    }\n}\n",
  };
  for (const [lang, code] of Object.entries(codes)) {
    const s = sample(lang, code);
    const files = Object.keys(s.prog.files);
    if (lang === "swift") { sh("swiftc", [...T.SWIFT_FLAGS, "-module-cache-path", path.join(s.dir, "mc"), "-o", "prog", ...files.filter((f) => f.endsWith(".swift"))], { cwd: s.dir }); expectRun(path.join(s.dir, "prog"), ["0", "t"], { cwd: s.dir }); }
    if (lang === "rust") { sh("rustc", ["--edition", "2021", "-O", "-A", "warnings", "-o", "prog", "main.rs"], { cwd: s.dir }); expectRun(path.join(s.dir, "prog"), ["0", "t"], { cwd: s.dir }); }
    if (lang === "dart") { sh("dart", ["compile", "kernel", "--verbosity", "error", "-o", "prog.dill", "main.dart"], { cwd: s.dir }); expectRun("dart", [path.join(s.dir, "prog.dill"), "0", "t"], { cwd: s.dir }); }
    if (lang === "c") { sh("gcc", [...T.C_FLAGS, "-o", "prog", "main.c", "-lm"], { cwd: s.dir }); expectRun(path.join(s.dir, "prog"), ["0", "t"], { cwd: s.dir, env: { ...process.env, ASAN_OPTIONS: "detect_leaks=0" } }); }
    if (lang === "ruby") expectRun("ruby", ["main.rb", "spec.json", "0", "t"], { cwd: s.dir });
    if (lang === "php") expectRun("php", ["main.php", "spec.json", "0", "t"], { cwd: s.dir });
    fs.rmSync(s.dir, { recursive: true, force: true });
  }
});

sh("chmod", ["-R", "a+rX", PREP]);
console.log("准备好了：" + PREP);
