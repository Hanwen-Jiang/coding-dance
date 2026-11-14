// 把资源仓里的 Markdown / JSON 解析成网站需要的数据。这里只有不变的题目资源，个人进度在 progress.ts 里从用户自己的进度仓读。

import type { IndexData, Level, ProblemDetail, ProblemSummary, Spec, Tier } from "../../lib/types";
import { byImportance } from "../../lib/types";
import { type Env, HttpError, listFiles, readText } from "./github";

const pad = (n: number) => String(n).padStart(4, "0");
const lines = (s: string) => s.split(/\r?\n/);
// 表格里的链接形如 [名字](<../problems/0208.实现 Trie (前缀树).md>)，路径里可能有括号
const LINK = String.raw`\[([^\]]+)\]\((?:<[^>]*>|[^)]*)\)`;

interface PlanRow {
  id: number;
  name: string;
  level: Level;
  topic: string;
}

/** studyplan/热题100.md：按专题分组的题单 */
function parsePlan(md: string): PlanRow[] {
  const out: PlanRow[] = [];
  const row = new RegExp(String.raw`^\|\s*(\d+)\s*\|\s*${LINK}\s*\|\s*(简单|中等|困难)\s*\|`);
  let topic = "";
  for (const line of lines(md)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      topic = h[1];
      continue;
    }
    const m = topic ? line.match(row) : null;
    if (m) out.push({ id: +m[1], name: m[2], level: m[3] as Level, topic });
  }
  return out;
}

/** studyplan/优先级清单.md：100 题按重要程度分成 P0–P3，「顺序」是全局排名 */
function parsePriority(md: string): Map<number, { tier: Tier; order: number }> {
  const map = new Map<number, { tier: Tier; order: number }>();
  let tier: Tier | null = null;
  for (const line of lines(md)) {
    const h = line.match(/^##\s+(P[0-3])\b/);
    if (h) {
      tier = h[1] as Tier;
      continue;
    }
    if (line.startsWith("## ")) tier = null;
    if (!tier || !line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((s) => s.trim());
    const order = Number(cells[0]), id = Number(cells[1]);
    if (id && order) map.set(id, { tier, order });
  }
  return map;
}

export async function loadIndex(env: Env): Promise<IndexData & { files: string[] }> {
  const [files, plan, prio] = await Promise.all([
    listFiles(env),
    readText(env, "studyplan/热题100.md"),
    readText(env, "studyplan/优先级清单.md"),
  ]);
  if (!plan) throw new HttpError(502, "仓库里没有 studyplan/热题100.md");
  const tiers = parsePriority(prio ?? "");
  const topics: string[] = [];
  const problems: ProblemSummary[] = parsePlan(plan).map((r, i) => {
    if (!topics.includes(r.topic)) topics.push(r.topic);
    const p = pad(r.id) + ".";
    const t = tiers.get(r.id);
    return {
      ...r,
      tier: t?.tier ?? "P3",
      order: t?.order ?? 100 + i,
      planOrder: i + 1,
      hasSpec: files.includes(`tools/illustrations/data/${pad(r.id)}.json`),
      hasIllustration: files.some((f) => f.startsWith("illustrations/" + p) && f.endsWith(".html")),
    };
  });
  return { problems, topics, files };
}

/** problems/<编号>.<题名>.md：取出力扣链接和「题目描述」一节的 HTML */
function parseProblemDoc(md: string) {
  const slug = md.match(/leetcode\.cn\/problems\/([\w-]+)/)?.[1] ?? null;
  const head = "## 题目描述";
  const start = md.indexOf(head);
  let html = "";
  if (start >= 0) {
    const rest = md.slice(start + head.length);
    const end = rest.search(/\r?\n## /);
    html = (end >= 0 ? rest.slice(0, end) : rest).trim();
  }
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/(src|href)="images\//g, '$1="/api/raw/problems/images/');
  return { slug, html };
}

export async function loadProblem(env: Env, id: number): Promise<ProblemDetail> {
  const index = await loadIndex(env);
  const summary = index.problems.find((p) => p.id === id);
  if (!summary) throw new HttpError(404, `题单里没有第 ${id} 题`);
  const p = pad(id) + ".";
  const files = index.files;
  const docPath = files.find((f) => f.startsWith("problems/" + p) && f.endsWith(".md"));
  const ill = files.find((f) => f.startsWith("illustrations/" + p) && f.endsWith(".html"));

  const [doc, specText] = await Promise.all([
    docPath ? readText(env, docPath) : Promise.resolve(null),
    summary.hasSpec ? readText(env, `tools/illustrations/data/${pad(id)}.json`) : Promise.resolve(null),
  ]);
  const { slug, html } = doc ? parseProblemDoc(doc) : { slug: null, html: "" };
  let spec: Spec | null = null;
  try {
    spec = specText ? (JSON.parse(specText) as Spec) : null;
  } catch {
    spec = null;
  }

  const ranked = index.problems.slice().sort(byImportance);
  const k = ranked.findIndex((x) => x.id === id);
  const link = (x?: ProblemSummary) => (x ? { id: x.id, name: x.name } : null);

  return {
    summary,
    slug,
    statementHtml: html,
    spec,
    illustrationUrl: ill ? "/api/raw/" + ill.split("/").map(encodeURIComponent).join("/") : null,
    prev: link(ranked[k - 1]),
    next: link(ranked[k + 1]),
  };
}
