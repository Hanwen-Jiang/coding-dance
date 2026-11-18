// C#：参数写成字面量；结果按运行时的类型写成 JSON（Prelude.cs）。方法名是力扣的大写开头写法（TwoSum）。
// 只给远端运行器（tools/runner）拼练习程序用；官方题解没有 C# 版本。
const fs = require("fs"), path = require("path");
const { fnName, methodName, strLit, charLit, dbl } = require("./names");

/** 力扣 C# 环境默认的 using（单独一个文件，用 global using，用户代码里再写一遍也没关系） */
const GLOBALS = ["System", "System.Collections", "System.Collections.Generic", "System.Linq", "System.Text", "System.Numerics", "System.Text.RegularExpressions"].map((n) => `global using ${n};`).join("\n") + "\n";
const prelude = fs.readFileSync(path.join(__dirname, "../prelude/Prelude.cs"), "utf8");
const NODE = `
public class Node {
    public int val;
    public Node next;
    public Node random;

    public Node(int _val) {
        val = _val;
        next = null;
        random = null;
    }
}

static class JR {
    static List<Node> made = new List<Node>();

    public static Node Build(int?[][] d) {
        made = new List<Node>();
        foreach (var x in d) made.Add(new Node(x[0].Value));
        for (int i = 0; i < d.Length; i++) {
            made[i].next = i + 1 < d.Length ? made[i + 1] : null;
            made[i].random = d[i][1] == null ? null : made[d[i][1].Value];
        }
        return made.Count == 0 ? null : made[0];
    }

    public static object Out(Node head) {
        var idx = new Dictionary<Node, int>(ReferenceEqualityComparer.Instance);
        for (var p = head; p != null && idx.Count < 100000; p = p.next) idx[p] = idx.Count;
        var old = new HashSet<Node>(made, ReferenceEqualityComparer.Instance);
        var res = new List<object>();
        for (var p = head; p != null && res.Count < 100000; p = p.next) {
            if (old.Contains(p)) return "没有复制：返回了原链表的节点";
            object r = p.random == null ? null : idx.TryGetValue(p.random, out var k) ? (object)k : "?";
            res.Add(new List<object> { p.val, r });
        }
        return res;
    }
}
`;

const BASE = { int: "int", long: "long", double: "double", bool: "bool", string: "string", char: "char", ListNode: "ListNode", TreeNode: "TreeNode", CycleList: "ListNode", JoinList: "ListNode", TreeRef: "TreeNode", RandomList: "Node" };
/** 参数的 C# 类型：数组是 T[]，List<T> 是 IList<T>（构造时用 List<T>） */
const ct = (t) => (t.base ? BASE[t.base] : t.list ? `IList<${ct(t.arr)}>` : `${ct(t.arr)}[]`);
const ints = (v) => `new int[]{${v.join(", ")}}`;

function lit(t, v) {
  if (t.arr) {
    const items = v.map((x) => lit(t.arr, x)).join(", ");
    return t.list ? `new List<${ct(t.arr)}>{${items}}` : `new ${ct(t.arr)}[]{${items}}`;
  }
  switch (t.base) {
    case "long": return `${v}L`;
    case "double": return dbl(v);
    case "bool": return v ? "true" : "false";
    case "string": return strLit("csharp", v);
    case "char": return charLit("csharp", v);
    case "ListNode": return `JH.MkList(${ints(v)})`;
    case "TreeNode": return `JH.MkTree(new int?[]{${v.map((x) => (x === null ? "null" : x)).join(", ")}})`;
    case "CycleList": return `JH.MkCycle(${ints(v[0])}, ${v[1] === null ? -1 : v[1]})`;
    case "JoinList": return `JH.MkJoin(${ints(v[0])}, ${v[1] === null ? -1 : v[1]})`;
    case "TreeRef": return `JH.Find(${v})`;
    case "RandomList": return `JR.Build(new int?[][]{${v.map(([x, r]) => `new int?[]{${x}, ${r === null ? "null" : r}}`).join(", ")}})`;
    default: return String(v);
  }
}
const outExpr = (t, e) => (t.base === "NodeIndex" ? `JH.Index(${e})` : t.base === "TreeVal" ? `JH.Val(${e})` : t.base === "RandomList" ? `JR.Out(${e})` : e);

/** 一个用例的语句；emit 把「结果的 JSON 字符串表达式」变成输出它的语句 */
function caseBody(sig, c, emit) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ["var res = new List<object> { null };", `var obj = new ${sig.cls}(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")});`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj.${methodName("csharp", sig.cls, ops[k])}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; res.Add(null);` : `res.Add(${outExpr(m.ret, call)});`);
    }
    return L.concat(emit("JH.Json(res)"));
  }
  const L = c.map((v, i) => `${ct(sig.params[i])} a${i} = ${lit(sig.params[i], v)};`);
  const call = `new Solution().${fnName("csharp", sig.fn)}(${c.map((_, i) => `a${i}`).join(", ")})`;
  if (sig.ret.base === "void") return L.concat(`${call};`, emit(`JH.Json(${outExpr(sig.params[sig.out], `a${sig.out}`)})`));
  return L.concat(emit(`JH.Json(${outExpr(sig.ret, call)})`));
}

module.exports = { id: "csharp", parts: { GLOBALS, prelude, NODE, caseBody, lit, ct } };
