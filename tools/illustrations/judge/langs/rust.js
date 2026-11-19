// Rust：参数写成带类型的字面量（Vec<i32>、Option<Box<ListNode>>、Option<Rc<RefCell<TreeNode>>>…），原地修改的参数传 &mut（和力扣的模板一样）；
// 结果按静态类型写成 JSON（prelude.rs 的 J）。函数名是下划线写法（two_sum）。
// 力扣没有 Rust 版本的题（链表成环、两条链表共用节点、带 random 指针的链表：Box 表示不了）不支持力扣模式。
// 只给远端运行器（tools/runner）拼练习程序用；官方题解没有 Rust 版本。
const fs = require("fs"), path = require("path");
const { fnName, methodName, strLit, charLit, dbl } = require("./names");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/prelude.rs"), "utf8");
/** 这些类型力扣的 Rust 版本表示不了（题目没有 Rust 版本） */
const UNSUPPORTED = ["CycleList", "JoinList", "NodeIndex", "RandomList"];

const TREE = "Option<Rc<RefCell<TreeNode>>>";
const BASE = { int: "i32", long: "i64", double: "f64", bool: "bool", string: "String", char: "char", ListNode: "Option<Box<ListNode>>", TreeNode: TREE, TreeRef: TREE };
const rt = (t) => (t.base ? BASE[t.base] : `Vec<${rt(t.arr)}>`).replace(/Rc<RefCell</g, "std::rc::Rc<std::cell::RefCell<");

function lit(t, v) {
  if (t.arr) return `vec![${v.map((x) => lit(t.arr, x)).join(", ")}]`;
  switch (t.base) {
    case "int": return `${v}`;
    case "long": return `${v}i64`;
    case "double": return dbl(v);
    case "bool": return v ? "true" : "false";
    case "string": return `String::from(${strLit("rust", v)})`;
    case "char": return charLit("rust", v);
    case "ListNode": return `__j::list(&[${v.join(", ")}])`;
    case "TreeNode": return `__j::tree(&[${v.map((x) => (x === null ? "None" : `Some(${x})`)).join(", ")}])`;
    case "TreeRef": return `__j::find(${v})`;
  }
  throw new Error("力扣没有这道题的 Rust 版本（" + t.src + " 用 Box 表示不了）");
}
const outExpr = (t, e) => (t.base === "TreeVal" ? `__j::tree_val(&${e})` : `__j::out(&${e})`);

/** 用例的函数体：最后一个表达式是结果的 JSON（String） */
function caseBody(sig, c) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ['let mut res: Vec<String> = vec!["null".to_string()];', `let mut obj = ${sig.cls}::new(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")});`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj.${methodName("rust", sig.cls, ops[k])}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; res.push("null".to_string());` : `{ let r = ${call}; res.push(${outExpr(m.ret, "r")}); }`);
    }
    return L.concat('format!("[{}]", res.join(","))');
  }
  const mut = (i) => sig.ret.base === "void" && i === sig.out;
  const L = c.map((v, i) => `let ${mut(i) ? "mut " : ""}a${i}: ${rt(sig.params[i])} = ${lit(sig.params[i], v)};`);
  const call = `Solution::${fnName("rust", sig.fn)}(${c.map((_, i) => (mut(i) ? `&mut a${i}` : `a${i}`)).join(", ")})`;
  if (sig.ret.base === "void") return L.concat(`${call};`, outExpr(sig.params[sig.out], `a${sig.out}`));
  return L.concat(`let r = ${call};`, outExpr(sig.ret, "r"));
}

module.exports = { id: "rust", parts: { prelude, caseBody, lit, rt, UNSUPPORTED } };
