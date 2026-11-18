// Scala 2.13：参数写成字面量（Array[Int]、Array[Array[Int]]、List[String]…，和力扣的模板一样）；结果按运行时的类型写成 JSON（Prelude.scala）。
// 函数题的解法写在 object Solution 里。只给远端运行器（tools/runner）拼练习程序用；官方题解没有 Scala 版本。
const fs = require("fs"), path = require("path");
const { fnName, methodName, strLit, charLit, dbl } = require("./names");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/Prelude.scala"), "utf8");
const NODE = `
class Node(var _value: Int) {
  var value: Int = _value
  var next: Node = null
  var random: Node = null
}

object JR {
  var made = scala.collection.mutable.ArrayBuffer[Node]()

  def build(d: Array[(Int, Option[Int])]): Node = {
    made = scala.collection.mutable.ArrayBuffer.from(d.map { case (x, _) => new Node(x) })
    for (i <- d.indices) {
      made(i).next = if (i + 1 < d.length) made(i + 1) else null
      made(i).random = d(i)._2.map(made(_)).orNull
    }
    made.headOption.orNull
  }

  def out(head: Node): Any = {
    val idx = new java.util.IdentityHashMap[Node, Integer]()
    var p = head
    while (p != null && idx.size < 100000) { idx.put(p, idx.size); p = p.next }
    val old = new java.util.IdentityHashMap[Node, Boolean]()
    made.foreach(old.put(_, true))
    val res = scala.collection.mutable.ArrayBuffer[Any]()
    p = head
    while (p != null && res.length < 100000) {
      if (old.containsKey(p)) return "没有复制：返回了原链表的节点"
      val r: Any = if (p.random == null) null else if (idx.containsKey(p.random)) idx.get(p.random).intValue else "?"
      res += List(p.value, r)
      p = p.next
    }
    res
  }
}
`;

const BASE = { int: "Int", long: "Long", double: "Double", bool: "Boolean", string: "String", char: "Char", ListNode: "ListNode", TreeNode: "TreeNode", CycleList: "ListNode", JoinList: "ListNode", TreeRef: "TreeNode", RandomList: "Node" };
const st = (t) => (t.base ? BASE[t.base] : t.list ? `List[${st(t.arr)}]` : `Array[${st(t.arr)}]`);
const ints = (v) => `Array[Int](${v.join(", ")})`;

function lit(t, v) {
  if (t.arr) return `${t.list ? "List" : "Array"}[${st(t.arr)}](${v.map((x) => lit(t.arr, x)).join(", ")})`;
  switch (t.base) {
    case "long": return `${v}L`;
    case "double": return dbl(v);
    case "bool": return v ? "true" : "false";
    case "string": return strLit("scala", v);
    case "char": return charLit("scala", v);
    case "ListNode": return `JH.list(${ints(v)})`;
    case "TreeNode": return `JH.tree(Array[Option[Int]](${v.map((x) => (x === null ? "None" : `Some(${x})`)).join(", ")}))`;
    case "CycleList": return `JH.cycle(${ints(v[0])}, ${v[1] === null ? -1 : v[1]})`;
    case "JoinList": return `JH.join(${ints(v[0])}, ${v[1] === null ? -1 : v[1]})`;
    case "TreeRef": return `JH.find(${v})`;
    case "RandomList": return `JR.build(Array[(Int, Option[Int])](${v.map(([x, r]) => `(${x}, ${r === null ? "None" : `Some(${r})`})`).join(", ")}))`;
    default: return String(v);
  }
}
const outExpr = (t, e) => (t.base === "NodeIndex" ? `JH.index(${e})` : t.base === "TreeVal" ? `JH.treeVal(${e})` : t.base === "RandomList" ? `JR.out(${e})` : e);

function caseBody(sig, c, emit) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ["val res = scala.collection.mutable.ArrayBuffer[Any](null)", `val obj = new ${sig.cls}(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")})`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj.${methodName("scala", sig.cls, ops[k])}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; res += null` : `res += ${outExpr(m.ret, call)}`);
    }
    return L.concat(emit("JH.json(res)"));
  }
  const L = c.map((v, i) => `val a${i}: ${st(sig.params[i])} = ${lit(sig.params[i], v)}`);
  const call = `Solution.${fnName("scala", sig.fn)}(${c.map((_, i) => `a${i}`).join(", ")})`;
  if (sig.ret.base === "void") return L.concat(call, emit(`JH.json(${outExpr(sig.params[sig.out], `a${sig.out}`)})`));
  return L.concat(emit(`JH.json(${outExpr(sig.ret, call)})`));
}

module.exports = { id: "scala", parts: { prelude, NODE, caseBody, lit, st } };
