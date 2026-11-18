// 练习区云端运行器新加的几种语言（C、C#、Kotlin、Swift、Rust、Ruby、PHP、Scala、Dart）共用的小工具：
// 力扣在各语言里给函数起的名字、各语言的字符串字面量。起始代码是力扣原样的（tools/practice/leetcode-starters.json），
// 这里的名字要和它一致；tools/practice/build.cjs 会逐题核对。
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const lcFirst = (s) => s[0].toLowerCase() + s.slice(1);
/** twoSum → two_sum，isValidBST → is_valid_bst，lengthOfLIS → length_of_lis */
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toLowerCase();

/** 力扣在 Ruby 里没有改成下划线写法的函数名 */
const RUBY_KEEP = new Set(["copyRandomList", "hasCycle", "detectCycle", "getIntersectionNode"]);

/** 函数题的函数名 */
function fnName(lang, fn) {
  if (lang === "csharp") return cap(fn);
  if (lang === "rust") return snake(fn);
  if (lang === "ruby") return RUBY_KEEP.has(fn) ? fn : snake(fn);
  return fn;
}
/** 设计类题的方法名；C 是「类名首字母小写 + 方法名首字母大写」的函数 */
function methodName(lang, cls, m) {
  if (lang === "c") return lcFirst(cls) + cap(m);
  if (lang === "csharp") return cap(m);
  if (lang === "rust" || lang === "ruby") return snake(m);
  return m;
}

const hex = (c) => c.codePointAt(0).toString(16);
/** 带转义的字符串字面量：Swift、Rust 用 \u{…}，Kotlin、Dart 还要转义 $（字符串模板） */
function strLit(lang, s) {
  if (lang === "swift" || lang === "rust") {
    return '"' + [...s].map((c) => (c === "\\" ? "\\\\" : c === '"' ? '\\"' : c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : c < " " || c === "\x7f" ? `\\u{${hex(c)}}` : c)).join("") + '"';
  }
  const j = JSON.stringify(s);
  return lang === "kotlin" || lang === "dart" ? j.replace(/\$/g, "\\$") : j;
}
/** C 的字符串字面量（按 UTF-8 字节，不可见的字节写成八进制）和它的字节数 */
function cStr(s) {
  const bytes = Buffer.from(s, "utf8");
  let out = '"';
  for (const b of bytes) {
    if (b === 0x22) out += '\\"';
    else if (b === 0x5c) out += "\\\\";
    else if (b === 0x3f) out += "\\?";
    else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
    else out += "\\" + b.toString(8).padStart(3, "0");
  }
  return { lit: out + '"', n: bytes.length };
}
/** 字符字面量（C、C#、Java、Kotlin、Scala、Rust 用单引号；Swift、Dart 用字符串） */
function charLit(lang, c) {
  if (lang === "swift" || lang === "dart") return strLit(lang, c);
  if (lang === "c") return c === "'" ? "'\\''" : c === "\\" ? "'\\\\'" : c >= " " && c < "\x7f" ? `'${c}'` : `'\\${c.charCodeAt(0).toString(8).padStart(3, "0")}'`;
  if (lang === "rust") return c === "'" ? "'\\''" : c === "\\" ? "'\\\\'" : `'${c}'`;
  return c === "'" ? "'\\''" : c === "\\" ? "'\\\\'" : `'${c}'`;
}
/** 实数字面量：整数也写成 x.0 */
const dbl = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));

module.exports = { cap, lcFirst, snake, fnName, methodName, strLit, cStr, charLit, dbl, RUBY_KEEP };
