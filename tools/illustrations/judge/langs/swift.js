// Swift：参数写成带类型的字面量（[Int]、[[Character]]…），原地修改的数组参数是 inout（和力扣的模板一样）；
// 结果按静态类型写成 JSON（Prelude.swift 的 JJ）。只给远端运行器（tools/runner）拼练习程序用；官方题解没有 Swift 版本。
const fs = require("fs"), path = require("path");
const { fnName, methodName, strLit, charLit, dbl } = require("./names");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/Prelude.swift"), "utf8");
const NODE = `
public class Node {
    public var val: Int
    public var next: Node?
    public var random: Node?
    public init(_ val: Int) {
        self.val = val
        self.next = nil
        self.random = nil
    }
}

var jMade: [Node] = []

func jRandom(_ d: [(Int, Int?)]) -> Node? {
    jMade = d.map { Node($0.0) }
    for i in 0..<d.count {
        jMade[i].next = i + 1 < d.count ? jMade[i + 1] : nil
        if let r = d[i].1 { jMade[i].random = jMade[r] }
    }
    return jMade.first
}

func jRandomOut(_ head: Node?) -> String {
    var nodes: [Node] = []
    var p = head
    while let x = p, nodes.count < 100000 { nodes.append(x); p = x.next }
    for x in nodes where jMade.contains(where: { $0 === x }) { return jQ("没有复制：返回了原链表的节点") }
    return "[" + nodes.map { x -> String in
        var r = "null"
        if let t = x.random { r = nodes.firstIndex(where: { $0 === t }).map { String($0) } ?? jQ("?") }
        return "[\\(x.val),\\(r)]"
    }.joined(separator: ",") + "]"
}
`;

const BASE = { int: "Int", long: "Int", double: "Double", bool: "Bool", string: "String", char: "Character", ListNode: "ListNode?", TreeNode: "TreeNode?", CycleList: "ListNode?", JoinList: "ListNode?", TreeRef: "TreeNode?", RandomList: "Node?" };
const sw = (t) => (t.base ? BASE[t.base] : `[${sw(t.arr)}]`);

function lit(t, v) {
  if (t.arr) return `[${v.map((x) => lit(t.arr, x)).join(", ")}]`;
  switch (t.base) {
    case "double": return dbl(v);
    case "bool": return v ? "true" : "false";
    case "string": return strLit("swift", v);
    case "char": return charLit("swift", v);
    case "ListNode": return `jList([${v.join(", ")}])`;
    case "TreeNode": return `jTree([${v.map((x) => (x === null ? "nil" : x)).join(", ")}])`;
    case "CycleList": return `jCycle([${v[0].join(", ")}], ${v[1] === null ? -1 : v[1]})`;
    case "JoinList": return `jJoin([${v[0].join(", ")}], ${v[1] === null ? -1 : v[1]})`;
    case "TreeRef": return `jFind(${v})`;
    case "RandomList": return `jRandom([${v.map(([x, r]) => `(${x}, ${r === null ? "nil" : r})`).join(", ")}])`;
    default: return String(v);
  }
}
/** 结果写成 JSON 的表达式（字符串） */
const outExpr = (t, e) => (t.base === "NodeIndex" ? `jIndex(${e})` : t.base === "TreeVal" ? `jTreeVal(${e})` : t.base === "RandomList" ? `jRandomOut(${e})` : `jOut(${e})`);

/** 用例的函数体：最后 return 结果的 JSON */
function caseBody(sig, c) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ['var res: [String] = ["null"]', `let obj = ${sig.cls}(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")})`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj.${methodName("swift", sig.cls, ops[k])}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; res.append("null")` : `res.append(${outExpr(m.ret, call)})`);
    }
    return L.concat('return "[" + res.joined(separator: ",") + "]"');
  }
  // 原地修改的数组参数是 inout，要用 var 声明、传 &
  const inout = (i) => sig.ret.base === "void" && i === sig.out && !!sig.params[i].arr;
  const L = c.map((v, i) => `${inout(i) ? "var" : "let"} a${i}: ${sw(sig.params[i])} = ${lit(sig.params[i], v)}`);
  const call = `Solution().${fnName("swift", sig.fn)}(${c.map((_, i) => (inout(i) ? `&a${i}` : `a${i}`)).join(", ")})`;
  if (sig.ret.base === "void") return L.concat(call, `return ${outExpr(sig.params[sig.out], `a${sig.out}`)}`);
  return L.concat(`return ${outExpr(sig.ret, call)}`);
}

module.exports = { id: "swift", parts: { prelude, NODE, caseBody, lit, sw } };
