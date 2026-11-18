// Java：每段代码放进自己的包（前置代码 + 题解 + 生成的 Main），所有包一次 javac 编译，再逐个运行。
const fs = require("fs"), path = require("path");
const { run, pool, hasTool, parseLines, usesType, cores } = require("../util");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/Prelude.java"), "utf8");
const BASE = {
  int: "int", long: "long", double: "double", bool: "boolean", string: "String", char: "char", ListNode: "ListNode", TreeNode: "TreeNode",
  CycleList: "ListNode", JoinList: "ListNode", NodeIndex: "ListNode", TreeRef: "TreeNode", TreeVal: "TreeNode", RandomList: "Node",
};

// 138 的节点类（和力扣的定义一样）和它的构造、输出。只在用到 RandomList 时带上，免得和题解自己写的 Node 类冲突
const NODE = `
class Node {
    int val;
    Node next;
    Node random;

    public Node(int val) {
        this.val = val;
        this.next = null;
        this.random = null;
    }
}

class HR {
    static ArrayList<Node> made = new ArrayList<>();

    static Node build(Integer[][] data) {
        made.clear();
        for (Integer[] d : data) made.add(new Node(d[0]));
        for (int i = 0; i < data.length; i++) {
            made.get(i).next = i + 1 < data.length ? made.get(i + 1) : null;
            made.get(i).random = data[i][1] == null ? null : made.get(data[i][1]);
        }
        return made.isEmpty() ? null : made.get(0);
    }

    static Object out(Node head) {
        IdentityHashMap<Node, Integer> idx = new IdentityHashMap<>();
        for (Node p = head; p != null && idx.size() < 100000; p = p.next) idx.put(p, idx.size());
        Set<Node> old = Collections.newSetFromMap(new IdentityHashMap<>());
        old.addAll(made);
        List<Object> out = new ArrayList<>();
        for (Node p = head; p != null && out.size() < 100000; p = p.next) {
            if (old.contains(p)) return "没有复制：返回了原链表的节点";
            Object r = p.random == null ? null : idx.containsKey(p.random) ? (Object) idx.get(p.random) : "?";
            out.add(Arrays.asList((Object) p.val, r));
        }
        return out;
    }
}
`;
/** 返回值要先换成什么再序列化 */
const outExpr = (t, e) => (t.base === "NodeIndex" ? `H.index(${e})` : t.base === "TreeVal" ? `H.val(${e})` : t.base === "RandomList" ? `HR.out(${e})` : e);
const BOX = { int: "Integer", long: "Long", double: "Double", bool: "Boolean", string: "String", char: "Character" };
const jt = (t) => (t.base ? BASE[t.base] : t.list ? `List<${box(t.arr)}>` : `${jt(t.arr)}[]`);
const box = (t) => (t.base ? BOX[t.base] || t.base : jt(t));
const ch = (c) => (c === "'" ? "'\\''" : c === "\\" ? "'\\\\'" : `'${c}'`);
const dbl = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));

function lit(t, v) {
  if (t.arr) {
    const items = v.map((x) => lit(t.arr, x)).join(", ");
    if (t.list) return v.length ? `new ArrayList<${box(t.arr)}>(Arrays.asList(${items}))` : `new ArrayList<${box(t.arr)}>()`;
    return `new ${jt(t)}{${items}}`;
  }
  switch (t.base) {
    case "long": return `${v}L`;
    case "double": return dbl(v);
    case "string": return JSON.stringify(v);
    case "char": return ch(v);
    case "ListNode": return `H.list(new int[]{${v.join(", ")}})`;
    case "TreeNode": return `H.tree(new Integer[]{${v.map((x) => (x === null ? "null" : x)).join(", ")}})`;
    case "CycleList": return `H.cycle(new int[]{${v[0].join(", ")}}, ${v[1] === null ? -1 : v[1]})`;
    case "JoinList": return `H.join(new int[]{${v[0].join(", ")}}, ${v[1] === null ? -1 : v[1]})`;
    case "TreeRef": return `H.find(${v})`;
    case "RandomList": return `HR.build(new Integer[][]{${v.map(([x, r]) => `{${x}, ${r === null ? "null" : r}}`).join(", ")}})`;
    default: return String(v);
  }
}

/** 一个用例的语句；emit 把「结果的 JSON 字符串表达式」变成输出它的语句（练习的远端运行器换成带分隔标记的输出） */
function caseBody(sig, c, emit = (json) => `System.out.println(${json});`) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ["List<Object> out = new ArrayList<>();", "out.add(null);", `${sig.cls} obj = new ${sig.cls}(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")});`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj.${ops[k]}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; out.add(null);` : `out.add(${outExpr(m.ret, call)});`);
    }
    return L.concat(emit("H.json(out)"));
  }
  const L = c.map((v, i) => `${jt(sig.params[i])} a${i} = ${lit(sig.params[i], v)};`), call = `new Solution().${sig.fn}(${c.map((_, i) => `a${i}`).join(", ")})`;
  if (sig.ret.base === "void") return L.concat(`${call};`, emit(`H.json(${outExpr(sig.params[sig.out], `a${sig.out}`)})`));
  return L.concat(emit(`H.json(${outExpr(sig.ret, call)})`));
}

function source(job) {
  // 题解里自己写的 import 要挪到文件开头
  const imports = [], body = [];
  // 力扣有些题的模板是 public class Solution；和 Main 放在同一个文件里时去掉 public
  for (const line of job.code.replace(/^public class /gm, "class ").split("\n")) (/^\s*import\s+[\w.*]+\s*;\s*$/.test(line) ? imports : body).push(line);
  return `package ${pkg(job)};

import java.util.*;
${imports.join("\n")}

${prelude}
${usesType(job.sig, "RandomList") ? NODE : ""}
${body.join("\n")}

public class Main {
${job.cases.map((c, k) => `    static void c${k}() {\n        H.reset();\n        ${caseBody(job.sig, c).join("\n        ")}\n    }`).join("\n")}

    public static void main(String[] args) {
${job.cases.map((_, k) => `        try { c${k}(); } catch (Throwable e) { System.out.println("{\\"__error\\":" + H.json(String.valueOf(e)) + "}"); }`).join("\n")}
    }
}
`;
}
const pkg = (job) => "j" + job.name.replace(/[^\w]/g, "_");

module.exports = {
  id: "java",
  /** 远端运行器（tools/runner）拼练习用的程序时用 */
  parts: { prelude, NODE, caseBody, lit, jt },
  available: () => hasTool("javac", ["-version"]),
  async runAll(jobs, dir) {
    const src = path.join(dir, "src"), out = path.join(dir, "out");
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    for (const job of jobs) {
      fs.mkdirSync(path.join(src, pkg(job)), { recursive: true });
      fs.writeFileSync(path.join(src, pkg(job), "Main.java"), source(job));
    }
    // 一次编译全部；有编译错误的包记下来、去掉，剩下的重新编译
    const failed = {};
    let live = jobs.slice();
    for (let round = 0; round < 6 && live.length; round++) {
      fs.writeFileSync(path.join(dir, "files.txt"), live.map((j) => JSON.stringify(path.join(src, pkg(j), "Main.java").replace(/\\/g, "/"))).join("\n"));
      const r = await run("javac", ["-encoding", "UTF-8", "-nowarn", "-Xlint:none", "-d", out, "@" + path.join(dir, "files.txt")], { timeout: 600000 });
      if (r.code === 0) break;
      const bad = {};
      for (const line of r.stderr.split(/\r?\n/)) {
        const m = line.match(/[\\/](j\w+)[\\/]Main\.java:\d+: (?:error|错误): (.*)$/);
        if (m) (bad[m[1]] = bad[m[1]] || []).push(m[2]);
      }
      if (!Object.keys(bad).length) throw new Error("javac 运行失败：" + r.stderr.slice(0, 800));
      for (const [p, msgs] of Object.entries(bad)) failed[p] = "编译没过：" + msgs.slice(0, 4).join(" | ");
      live = live.filter((j) => !failed[pkg(j)]);
    }
    return pool(jobs, cores, async (job) => {
      if (failed[pkg(job)]) return { error: failed[pkg(job)] };
      const r = await run("java", ["-Xss64m", "-cp", out, `${pkg(job)}.Main`]);
      return { outputs: parseLines(r.stdout, job.cases.length, r.timedOut ? "超时" : r.stderr.trim().split("\n").slice(0, 3).join(" | ")) };
    });
  },
};
