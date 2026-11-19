// Dart：参数写成带类型的字面量（<int>[…]、<List<int>>[…]…，和力扣的模板一样）；结果按运行时的类型写成 JSON（prelude.dart）。
// 只给远端运行器（tools/runner）拼练习程序用；官方题解没有 Dart 版本。
const fs = require("fs"), path = require("path");
const { fnName, methodName, strLit, charLit, dbl } = require("./names");

/** 用户代码前面的 import（力扣 Dart 环境里常用的库；用户自己再 import 一遍也行） */
const IMPORTS = ["import 'dart:math';", "import 'dart:collection';", "import 'dart:io' as jio;"];
const prelude = fs.readFileSync(path.join(__dirname, "../prelude/prelude.dart"), "utf8");
const NODE = `
class Node {
  int val;
  Node? next;
  Node? random;
  Node([this.val = 0, this.next, this.random]);
}

class JR {
  static List<Node> made = [];

  static Node? build(List<List<int?>> d) {
    made = [for (final x in d) Node(x[0]!)];
    for (var i = 0; i < d.length; i++) {
      made[i].next = i + 1 < d.length ? made[i + 1] : null;
      made[i].random = d[i][1] == null ? null : made[d[i][1]!];
    }
    return made.isEmpty ? null : made[0];
  }

  static Object? out(Node? head) {
    final idx = Map<Node, int>.identity();
    for (var p = head; p != null && idx.length < 100000; p = p.next) {
      idx[p] = idx.length;
    }
    final old = Set<Node>.identity()..addAll(made);
    final res = <Object?>[];
    for (var p = head; p != null && res.length < 100000; p = p.next) {
      if (old.contains(p)) return "没有复制：返回了原链表的节点";
      final r = p.random;
      res.add([p.val, r == null ? null : (idx[r] ?? "?")]);
    }
    return res;
  }
}
`;

const BASE = { int: "int", long: "int", double: "double", bool: "bool", string: "String", char: "String", ListNode: "ListNode?", TreeNode: "TreeNode?", CycleList: "ListNode?", JoinList: "ListNode?", TreeRef: "TreeNode?", RandomList: "Node?" };
const dt = (t) => (t.base ? BASE[t.base] : `List<${dt(t.arr)}>`);
const ints = (v) => `<int>[${v.join(", ")}]`;

function lit(t, v) {
  if (t.arr) return `<${dt(t.arr)}>[${v.map((x) => lit(t.arr, x)).join(", ")}]`;
  switch (t.base) {
    case "double": return dbl(v);
    case "bool": return v ? "true" : "false";
    case "string": return strLit("dart", v);
    case "char": return charLit("dart", v);
    case "ListNode": return `JH.list(${ints(v)})`;
    case "TreeNode": return `JH.tree(<int?>[${v.map((x) => (x === null ? "null" : x)).join(", ")}])`;
    case "CycleList": return `JH.cycle(${ints(v[0])}, ${v[1] === null ? -1 : v[1]})`;
    case "JoinList": return `JH.join(${ints(v[0])}, ${v[1] === null ? -1 : v[1]})`;
    case "TreeRef": return `JH.find(${v})`;
    case "RandomList": return `JR.build(<List<int?>>[${v.map(([x, r]) => `[${x}, ${r === null ? "null" : r}]`).join(", ")}])`;
    default: return String(v);
  }
}
const outExpr = (t, e) => (t.base === "NodeIndex" ? `JH.index(${e})` : t.base === "TreeVal" ? `JH.treeVal(${e})` : t.base === "RandomList" ? `JR.out(${e})` : e);

/** 用例的函数体：最后 return 结果的 JSON */
function caseBody(sig, c) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ["final res = <Object?>[null];", `final obj = ${sig.cls}(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")});`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj.${methodName("dart", sig.cls, ops[k])}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; res.add(null);` : `res.add(${outExpr(m.ret, call)});`);
    }
    return L.concat("return JH.json(res);");
  }
  const L = c.map((v, i) => `final ${dt(sig.params[i])} a${i} = ${lit(sig.params[i], v)};`);
  const call = `Solution().${fnName("dart", sig.fn)}(${c.map((_, i) => `a${i}`).join(", ")})`;
  if (sig.ret.base === "void") return L.concat(`${call};`, `return JH.json(${outExpr(sig.params[sig.out], `a${sig.out}`)});`);
  return L.concat(`return JH.json(${outExpr(sig.ret, call)});`);
}

module.exports = { id: "dart", parts: { IMPORTS, prelude, NODE, caseBody, lit, dt } };
