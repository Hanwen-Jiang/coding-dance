// Go：每段代码一个 main 包（前置代码 + 题解 + 生成的 main.go），输入直接写成 Go 的字面量。
const fs = require("fs"), path = require("path");
const { run, pool, hasTool, parseLines, usesType, cores } = require("../util");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/prelude.go"), "utf8");
const BASE = {
  int: "int", long: "int64", double: "float64", bool: "bool", string: "string", char: "byte", ListNode: "*ListNode", TreeNode: "*TreeNode",
  CycleList: "*ListNode", JoinList: "*ListNode", NodeIndex: "*ListNode", TreeRef: "*TreeNode", TreeVal: "*TreeNode", RandomList: "*Node",
};

// 138 的节点类型（和力扣的定义一样）和它的构造、输出。只在用到 RandomList 时带上，免得和题解自己写的 Node 冲突
const NODE = `package main

type Node struct {
	Val    int
	Next   *Node
	Random *Node
}

var judgeMade []*Node

func judgeRandom(d [][]any) *Node {
	judgeMade = nil
	for _, x := range d {
		judgeMade = append(judgeMade, &Node{Val: x[0].(int)})
	}
	for i, x := range d {
		if i+1 < len(d) {
			judgeMade[i].Next = judgeMade[i+1]
		}
		if x[1] != nil {
			judgeMade[i].Random = judgeMade[x[1].(int)]
		}
	}
	if len(judgeMade) == 0 {
		return nil
	}
	return judgeMade[0]
}

func judgeRandomVals(head *Node) any {
	idx := map[*Node]int{}
	for p := head; p != nil && len(idx) < 100000; p = p.Next {
		idx[p] = len(idx)
	}
	old := map[*Node]bool{}
	for _, n := range judgeMade {
		old[n] = true
	}
	out := [][]any{}
	for p := head; p != nil && len(out) < 100000; p = p.Next {
		if old[p] {
			return "没有复制：返回了原链表的节点"
		}
		var r any
		if p.Random != nil {
			if k, ok := idx[p.Random]; ok {
				r = k
			} else {
				r = "?"
			}
		}
		out = append(out, []any{p.Val, r})
	}
	return out
}
`;
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
    case "CycleList": return `judgeCycle([]int{${v[0].join(", ")}}, ${v[1] === null ? -1 : v[1]})`;
    case "JoinList": return `judgeJoin([]int{${v[0].join(", ")}}, ${v[1] === null ? -1 : v[1]})`;
    case "TreeRef": return `judgeFind(${v})`;
    case "RandomList": return `judgeRandom([][]any{${v.map(([x, r]) => `{${x}, ${r === null ? "nil" : r}}`).join(", ")}})`;
    default: return String(v);
  }
}
/** 把返回值变成能直接序列化成 JSON 的东西 */
function conv(t, expr) {
  if (t.base === "ListNode") return `judgeListVals(${expr})`;
  if (t.base === "TreeNode") return `judgeTreeVals(${expr})`;
  if (t.base === "NodeIndex") return `judgeIndex(${expr})`;
  if (t.base === "TreeVal") return `judgeVal(${expr})`;
  if (t.base === "RandomList") return `judgeRandomVals(${expr})`;
  if (t.base === "char") return `string(rune(${expr}))`;
  if (t.arr && t.arr.base === "char") return `judgeBytes(${expr})`;
  if (t.arr && t.arr.arr && t.arr.arr.base === "char") return `judgeBytes2(${expr})`;
  return expr;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// 力扣的 Go 环境会自动导入常用的包，题解里不写 import；这里照样按用到的包补上
const PKGS = [
  ["sort", "sort"], ["strings", "strings"], ["strconv", "strconv"], ["math", "math"], ["heap", "container/heap"],
  ["list", "container/list"], ["bits", "math/bits"], ["rand", "math/rand"], ["slices", "slices"], ["maps", "maps"],
  ["bytes", "bytes"], ["unicode", "unicode"], ["fmt", "fmt"],
];
function withImports(code) {
  const body = code.replace(/\/\/.*$/gm, "").replace(/"(?:[^"\\]|\\.)*"/g, '""'); // 注释和字符串里的不算
  const used = PKGS.filter(([name]) => new RegExp(`\\b${name}\\.[A-Za-z]`).test(body)).map(([, p]) => `\t"${p}"`);
  return used.length ? `import (\n${used.join("\n")}\n)\n\n${code}` : code;
}

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
${job.cases.map((c) => `\tjudgeRun(func() any {\n\t\tjudgeReset()\n\t\t${caseBody(job.sig, c).join("\n\t\t")}\n\t})`).join("\n")}
}
`;

module.exports = {
  id: "go",
  /** 远端运行器（tools/runner）拼练习用的程序时用 */
  parts: { prelude, NODE, caseBody, withImports, PKGS },
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
      fs.writeFileSync(path.join(pkg, "sol.go"), "package main\n\n" + withImports(job.code) + "\n");
      fs.writeFileSync(path.join(pkg, "main.go"), mainGo(job));
      if (usesType(job.sig, "RandomList")) fs.writeFileSync(path.join(pkg, "random.go"), NODE);
      const bin = path.join(dir, "bin", job.name + exe);
      const b = await run("go", ["build", "-o", bin, "./j" + job.name], { cwd: dir, timeout: 180000 });
      if (b.code !== 0) return { error: "编译没过：" + b.stderr.split("\n").filter((l) => l && !l.startsWith("#")).slice(0, 6).join(" | ") };
      const r = await run(bin, []);
      return { outputs: parseLines(r.stdout, job.cases.length, r.timedOut ? "超时" : r.stderr.trim().split("\n").slice(0, 3).join(" | ")) };
    });
  },
};
