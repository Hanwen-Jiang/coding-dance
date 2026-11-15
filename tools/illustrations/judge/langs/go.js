// Go：每段代码一个 main 包（前置代码 + 题解 + 生成的 main.go），输入直接写成 Go 的字面量。
const fs = require("fs"), path = require("path");
const { run, pool, hasTool, parseLines, cores } = require("../util");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/prelude.go"), "utf8");
const BASE = { int: "int", long: "int64", double: "float64", bool: "bool", string: "string", char: "byte", ListNode: "*ListNode", TreeNode: "*TreeNode" };
const gt = (t) => (t.base ? BASE[t.base] : `[]${gt(t.arr)}`);
const ch = (c) => (c === "'" ? "'\\''" : c === "\\" ? "'\\\\'" : `'${c}'`);

function lit(t, v) {
  if (t.arr) return `${gt(t)}{${v.map((x) => lit(t.arr, x)).join(", ")}}`;
  switch (t.base) {
    case "long": return `int64(${v})`;
    case "double": return `float64(${v})`;
    case "string": return JSON.stringify(v);
    case "char": return `byte(${ch(v)})`;
    case "ListNode": return `judgeList([]int{${v.join(", ")}})`;
    case "TreeNode": return `judgeTree([]any{${v.map((x) => (x === null ? "nil" : x)).join(", ")}})`;
    default: return String(v);
  }
}
/** 把返回值变成能直接序列化成 JSON 的东西 */
function conv(t, expr) {
  if (t.base === "ListNode") return `judgeListVals(${expr})`;
  if (t.base === "TreeNode") return `judgeTreeVals(${expr})`;
  if (t.base === "char") return `string(rune(${expr}))`;
  if (t.arr && t.arr.base === "char") return `judgeBytes(${expr})`;
  if (t.arr && t.arr.arr && t.arr.arr.base === "char") return `judgeBytes2(${expr})`;
  return expr;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function caseBody(sig, c) {
  if (sig.kind === "design") {
    const [ops, argv] = c, L = ["out := []any{nil}", `obj := Constructor(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")})`, "_ = obj"];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj.${cap(ops[k])}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}\n\t\tout = append(out, nil)` : `out = append(out, ${conv(m.ret, call)})`);
    }
    return L.concat("return out");
  }
  const L = c.map((v, i) => `a${i} := ${lit(sig.params[i], v)}`), call = `${sig.fn}(${c.map((_, i) => `a${i}`).join(", ")})`;
  if (sig.ret.base === "void") return L.concat(call, `return ${conv(sig.params[sig.out], `a${sig.out}`)}`);
  return L.concat(`return ${conv(sig.ret, call)}`);
}

const mainGo = (job) => `package main

import (
	"encoding/json"
	"fmt"
)

func judgeRun(f func() any) {
	defer func() {
		if r := recover(); r != nil {
			b, _ := json.Marshal(map[string]string{"__error": fmt.Sprint(r)})
			fmt.Println(string(b))
		}
	}()
	b, err := json.Marshal(f())
	if err != nil {
		b, _ = json.Marshal(map[string]string{"__error": err.Error()})
	}
	fmt.Println(string(b))
}

func main() {
${job.cases.map((c) => `\tjudgeRun(func() any {\n\t\t${caseBody(job.sig, c).join("\n\t\t")}\n\t})`).join("\n")}
}
`;

module.exports = {
  id: "go",
  available: () => hasTool("go", ["version"]),
  async runAll(jobs, dir) {
    fs.mkdirSync(path.join(dir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(dir, "go.mod"), "module judge\n\ngo 1.21\n");
    const exe = process.platform === "win32" ? ".exe" : "";
    return pool(jobs, cores, async (job) => {
      const pkg = path.join(dir, "j" + job.name);
      fs.rmSync(pkg, { recursive: true, force: true });
      fs.mkdirSync(pkg, { recursive: true });
      fs.writeFileSync(path.join(pkg, "prelude.go"), prelude);
      fs.writeFileSync(path.join(pkg, "sol.go"), "package main\n\n" + job.code + "\n");
      fs.writeFileSync(path.join(pkg, "main.go"), mainGo(job));
      const bin = path.join(dir, "bin", job.name + exe);
      const b = await run("go", ["build", "-o", bin, "./j" + job.name], { cwd: dir, timeout: 180000 });
      if (b.code !== 0) return { error: "编译没过：" + b.stderr.split("\n").filter((l) => l && !l.startsWith("#")).slice(0, 6).join(" | ") };
      const r = await run(bin, []);
      return { outputs: parseLines(r.stdout, job.cases.length, r.timedOut ? "超时" : r.stderr.trim().split("\n").slice(0, 3).join(" | ")) };
    });
  },
};
