// 从力扣（leetcode.cn 的公开 GraphQL，只读）取 100 题在 C、C#、Kotlin、Swift、Rust、Ruby、PHP、Scala、Dart 下的起始代码，
// 原样存进 tools/practice/leetcode-starters.json（build.cjs 用它做这几种语言的力扣模式起始代码）。
// 题目的 slug 从 problems/*.md 的原题链接里读。力扣没有提供的（Rust、Dart 的几道链表题）不存，见 templates.cjs 的 AUTHORED_STARTERS。
// 用法（仓库根目录）：node tools/practice/fetch-starters.mjs [--cache <之前取过的 JSON>]
//   --cache：已经取过的原始结果（{ "<题号>": { slug, snippets: { <langSlug>: code } } }），有就不再请求。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "tools/practice/leetcode-starters.json");
export const STARTER_LANGS = ["c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"];

const argv = process.argv.slice(2);
const cacheFile = argv.includes("--cache") ? argv[argv.indexOf("--cache") + 1] : null;
const cache = cacheFile && fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};

const problems = [];
for (const f of fs.readdirSync(path.join(root, "problems")).filter((f) => /^\d{4}\..*\.md$/.test(f)).sort()) {
  const m = fs.readFileSync(path.join(root, "problems", f), "utf8").match(/leetcode\.cn\/problems\/([a-z0-9-]+)/);
  if (m) problems.push({ id: Number(f.slice(0, 4)), slug: m[1] });
}
if (problems.length !== 100) throw new Error(`题目文档里读到 ${problems.length} 个原题链接，应该是 100 个`);

const query = "query q($titleSlug: String!) { question(titleSlug: $titleSlug) { codeSnippets { langSlug code } } }";
async function fetchSnippets(slug) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch("https://leetcode.cn/graphql/", { method: "POST", headers: { "content-type": "application/json", referer: `https://leetcode.cn/problems/${slug}/` }, body: JSON.stringify({ query, variables: { titleSlug: slug } }) });
    const j = r.ok ? await r.json().catch(() => null) : null;
    const list = j?.data?.question?.codeSnippets;
    if (list) return Object.fromEntries(list.map((s) => [s.langSlug, s.code]));
    await new Promise((s) => setTimeout(s, 3000 * (attempt + 1)));
  }
  throw new Error(`${slug}：取不到起始代码`);
}

const result = {};
for (const p of problems) {
  const snippets = cache[p.id]?.snippets || (await fetchSnippets(p.slug));
  if (!cache[p.id]) await new Promise((s) => setTimeout(s, 1200));
  result[p.id] = Object.fromEntries(STARTER_LANGS.filter((l) => snippets[l] != null).map((l) => [l, snippets[l].replace(/\r\n/g, "\n")]));
  console.log(String(p.id).padStart(4, "0"), Object.keys(result[p.id]).length, "种语言");
}
fs.writeFileSync(out, JSON.stringify(result, null, 1) + "\n");
console.log("写好了：" + path.relative(root, out));
