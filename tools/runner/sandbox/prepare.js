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

sh("chmod", ["-R", "a+rX", PREP]);
console.log("准备好了：" + PREP);
