// 题解代码的两件事：
// 1) 「步骤标记」：代码行尾写 #@tag（Python）或 //@tag（其他语言），演示里每一步用 at: "tag" 指到这些行。
//    一行可以写多个 tag（逗号分隔），同一个 tag 可以标在多行上。导出时标记会被去掉，只留下 tag → 行号。
// 2) 多语言：Python 写在 spec 里，其他语言放在 code/<目录>/<key>.<后缀>，内容是能直接提交到力扣的代码。
const fs = require("fs"), path = require("path");

const ROOT = path.join(__dirname, "..");
/** 官方题解支持的语言，顺序就是网站上显示的顺序 */
const LANGS = [
  { id: "python", ext: "py" },
  { id: "java", ext: "java" },
  { id: "cpp", ext: "cpp" },
  { id: "go", ext: "go" },
  { id: "javascript", ext: "js" },
  { id: "typescript", ext: "ts" },
];
const FILE_LANGS = LANGS.filter((l) => l.id !== "python");
const MARK = /[ \t]*(?:#|\/\/)@([\w-]+(?:,[\w-]+)*)[ \t]*$/;

/** 去掉开头的空行、结尾的空白和每行的标记，返回干净的代码和 tag → 行号（从 1 开始） */
function parseCode(src) {
  const marks = {};
  const lines = src.replace(/\r\n/g, "\n").replace(/^\n+|\s+$/g, "").split("\n").map((line, i) => {
    const m = line.match(MARK);
    if (!m) return line;
    for (const t of m[1].split(",")) (marks[t] = marks[t] || []).push(i + 1);
    return line.replace(MARK, "");
  });
  return { code: lines.join("\n"), marks };
}

const pad4 = (id) => String(id).padStart(4, "0");
/** 一段代码的 key：第一段是 std；其余的要自己写 key，演示的其他解法（alts[].code）才能引用它 */
const keyOf = (codes, i) => codes[i].key || (i === 0 ? "std" : null);

/** 读一段代码的其他语言版本（带标记的原文），没有的语言不出现 */
function readLangs(dirName, key) {
  const out = {};
  if (!key) return out;
  for (const l of FILE_LANGS) {
    const f = path.join(ROOT, "code", dirName, `${key}.${l.ext}`);
    if (fs.existsSync(f)) out[l.id] = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  }
  return out;
}

/**
 * 一份 spec（或专题的一小节）里的所有代码，连同各语言版本。
 * 返回 [{ i, key, t, kind, note, raw: { python, java, … } }]，raw 是带标记的原文。
 */
function codesOf(codes, dirName) {
  return codes.map((c, i) => {
    const key = keyOf(codes, i);
    return { i, key, t: c.t, kind: c.kind || null, note: c.note || null, judge: c.judge !== false, raw: { python: c.code, ...readLangs(dirName, key) } };
  });
}

/** 检查一段代码各语言的 tag 集合和 Python 一致；不一致返回说明文字 */
function markMismatch(entry) {
  const py = Object.keys(parseCode(entry.raw.python).marks).sort().join(",");
  for (const [lang, raw] of Object.entries(entry.raw)) {
    if (lang === "python") continue;
    const got = Object.keys(parseCode(raw).marks).sort().join(",");
    if (got !== py) return `${lang} 的标记是 [${got}]，Python 的是 [${py}]`;
  }
  return null;
}

module.exports = { ROOT, LANGS, FILE_LANGS, parseCode, pad4, keyOf, readLangs, codesOf, markMismatch };
