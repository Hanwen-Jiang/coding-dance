// Kotlin：参数写成字面量（IntArray、Array<IntArray>、List<String>…，和力扣的模板一样）；结果按运行时的类型写成 JSON（Prelude.kt）。
// 只给远端运行器（tools/runner）拼练习程序用；官方题解没有 Kotlin 版本。
const fs = require("fs"), path = require("path");
const { fnName, methodName, strLit, charLit, dbl } = require("./names");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/Prelude.kt"), "utf8");
const NODE = `
class Node(var \`val\`: Int) {
    var next: Node? = null
    var random: Node? = null
}

object JR {
    var made = ArrayList<Node>()

    fun build(d: Array<Array<Int?>>): Node? {
        made = ArrayList()
        for (x in d) made.add(Node(x[0]!!))
        for (i in d.indices) {
            made[i].next = if (i + 1 < d.size) made[i + 1] else null
            made[i].random = d[i][1]?.let { made[it] }
        }
        return made.firstOrNull()
    }

    fun out(head: Node?): Any? {
        val idx = java.util.IdentityHashMap<Node, Int>()
        var p = head
        while (p != null && idx.size < 100000) { idx[p] = idx.size; p = p.next }
        val old = java.util.Collections.newSetFromMap(java.util.IdentityHashMap<Node, Boolean>())
        old.addAll(made)
        val res = ArrayList<Any?>()
        p = head
        while (p != null && res.size < 100000) {
            if (p in old) return "没有复制：返回了原链表的节点"
            val r = p.random
            res.add(listOf(p.\`val\`, if (r == null) null else idx[r] ?: "?"))
            p = p.next
        }
        return res
    }
}
`;

const PRIM = { int: "Int", long: "Long", double: "Double", bool: "Boolean", char: "Char" };
const BASE = { ...PRIM, string: "String", ListNode: "ListNode?", TreeNode: "TreeNode?", CycleList: "ListNode?", JoinList: "ListNode?", TreeRef: "TreeNode?", RandomList: "Node?" };
const ARR = { int: "IntArray", long: "LongArray", double: "DoubleArray", bool: "BooleanArray", char: "CharArray" };
/** 参数的 Kotlin 类型：int[] 是 IntArray，int[][] 是 Array<IntArray>，List<T> 是 List<T> */
const kt = (t) => (t.base ? BASE[t.base] : t.list ? `List<${kt(t.arr)}>` : t.arr.base && ARR[t.arr.base] ? ARR[t.arr.base] : `Array<${kt(t.arr)}>`);
const ARR_OF = { int: "intArrayOf", long: "longArrayOf", double: "doubleArrayOf", bool: "booleanArrayOf", char: "charArrayOf" };
const int = (v) => (v === -2147483648 ? "Int.MIN_VALUE" : String(v));
const ints = (v) => `intArrayOf(${v.map(int).join(", ")})`;

function lit(t, v) {
  if (t.arr) {
    const items = v.map((x) => lit(t.arr, x)).join(", ");
    if (t.list) return `listOf<${kt(t.arr)}>(${items})`;
    if (t.arr.base && ARR_OF[t.arr.base]) return `${ARR_OF[t.arr.base]}(${items})`;
    return `arrayOf<${kt(t.arr)}>(${items})`;
  }
  switch (t.base) {
    case "int": return int(v);
    case "long": return `${v}L`;
    case "double": return dbl(v);
    case "bool": return v ? "true" : "false";
    case "string": return strLit("kotlin", v);
    case "char": return charLit("kotlin", v);
    case "ListNode": return `JH.list(${ints(v)})`;
    case "TreeNode": return `JH.tree(arrayOf<Int?>(${v.map((x) => (x === null ? "null" : int(x))).join(", ")}))`;
    case "CycleList": return `JH.cycle(${ints(v[0])}, ${v[1] === null ? -1 : v[1]})`;
    case "JoinList": return `JH.join(${ints(v[0])}, ${v[1] === null ? -1 : v[1]})`;
    case "TreeRef": return `JH.find(${int(v)})`;
    case "RandomList": return `JR.build(arrayOf<Array<Int?>>(${v.map(([x, r]) => `arrayOf<Int?>(${x}, ${r === null ? "null" : r})`).join(", ")}))`;
    default: return String(v);
  }
}
const outExpr = (t, e) => (t.base === "NodeIndex" ? `JH.index(${e})` : t.base === "TreeVal" ? `JH.treeVal(${e})` : t.base === "RandomList" ? `JR.out(${e})` : e);

function caseBody(sig, c, emit) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ["val res = arrayListOf<Any?>(null)", `val obj = ${sig.cls}(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")})`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj.${methodName("kotlin", sig.cls, ops[k])}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; res.add(null)` : `res.add(${outExpr(m.ret, call)})`);
    }
    return L.concat(emit("JH.json(res)"));
  }
  const L = c.map((v, i) => `val a${i}: ${kt(sig.params[i])} = ${lit(sig.params[i], v)}`);
  const call = `Solution().${fnName("kotlin", sig.fn)}(${c.map((_, i) => `a${i}`).join(", ")})`;
  if (sig.ret.base === "void") return L.concat(call, emit(`JH.json(${outExpr(sig.params[sig.out], `a${sig.out}`)})`));
  return L.concat(emit(`JH.json(${outExpr(sig.ret, call)})`));
}

module.exports = { id: "kotlin", parts: { prelude, NODE, caseBody, lit, kt } };
