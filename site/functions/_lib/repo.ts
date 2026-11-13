// 把仓库里的 Markdown / JSON / 源码文件解析成网站需要的数据

import type { HistoryFile, IndexData, Level, ProblemDetail, ProblemSummary, Spec, Status, Tier } from "../../lib/types";
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
  status: Status;
}

/** studyplan/热题100.md：按专题分组的进度表 */
function parsePlan(md: string): PlanRow[] {
  const out: PlanRow[] = [];
  const row = new RegExp(String.raw`^\|\s*(\d+)\s*\|\s*${LINK}\s*\|\s*(简单|中等|困难)\s*\|([^|]*)\|`);
  let topic = "";
  for (const line of lines(md)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      topic = h[1] === "进度概览" ? "" : h[1];
      continue;
    }
    const m = topic ? line.match(row) : null;
    if (!m) continue;
    const status = (m[4].match(/已通过|曾通过|未开始/)?.[0] ?? "未开始") as Status;
    out.push({ id: +m[1], name: m[2], level: m[3] as Level, topic, status });
  }
  return out;
}

/** studyplan/优先级清单.md：P0 / P1 / P2 / 复习 / 已排除的困难题 */
function parsePriority(md: string): Map<number, { tier: Tier; order: number }> {
  const map = new Map<number, { tier: Tier; order: number }>();
  let tier: Tier | null = null;
  let k = 0;
  for (const line of lines(md)) {
    if (line.startsWith("## ")) {
      const h = line.slice(3);
      tier = h.startsWith("P0") ? "P0" : h.startsWith("P1") ? "P1" : h.startsWith("P2") ? "P2"
        : h.startsWith("复习") ? "复习" : h.startsWith("已排除") ? "困难" : null;
      k = 0;
      continue;
    }
    if (!tier || !line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((s) => s.trim());
    if (tier === "困难") {
      const id = Number(cells[0]);
      if (id) map.set(id, { tier, order: ++k });
    } else {
      const order = Number(cells[0]), id = Number(cells[1]);
      if (id && order) map.set(id, { tier, order });
    }
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
    const rank = (l: string) => ["java", "python", "go"].indexOf(l) + 1 || 9;
    const langs = [...new Set(files.filter((f) => f.startsWith("solutions/") && (f.split("/")[2] ?? "").startsWith(p)).map((f) => f.split("/")[1]))]
      .sort((a, b) => rank(a) - rank(b));
    const t = tiers.get(r.id);
    return {
      ...r,
      tier: t?.tier ?? (r.status === "已通过" ? "已通过" : "P2"),
      order: t?.order ?? i + 1,
      planOrder: i + 1,
      langs,
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

const LANG_LABEL: Record<string, string> = { java: "Java", python: "Python", go: "Go", cpp: "C++", js: "JavaScript", ts: "TypeScript" };

/** LeetCode 插件生成的 Java 文件里，只取 submit region 之间的代码 */
function trimSolution(lang: string, src: string) {
  if (lang === "java") {
    // 两种插件标记：//leetcode submit region begin(...) 和 //IMPORTANT!! Submit Code Region Begin(...)
    const re = /\/\/[^\n]*?submit (?:code )?region begin[^\n]*\n([\s\S]*?)\/\/[^\n]*?submit (?:code )?region end/gi;
    const parts = [...src.matchAll(re)].map((m) => m[1].replace(/\s+$/, ""));
    if (parts.length) return parts.join("\n\n");
  }
  return src.replace(/\s+$/, "");
}

export async function loadProblem(env: Env, id: number): Promise<ProblemDetail> {
  const index = await loadIndex(env);
  const summary = index.problems.find((p) => p.id === id);
  if (!summary) throw new HttpError(404, `题单里没有第 ${id} 题`);
  const p = pad(id) + ".";
  const files = index.files;
  const docPath = files.find((f) => f.startsWith("problems/" + p) && f.endsWith(".md"));
  const solPaths = files.filter((f) => f.startsWith("solutions/") && (f.split("/")[2] ?? "").startsWith(p)).sort();
  const ill = files.find((f) => f.startsWith("illustrations/" + p) && f.endsWith(".html"));

  const [doc, specText, ...sols] = await Promise.all([
    docPath ? readText(env, docPath) : Promise.resolve(null),
    summary.hasSpec ? readText(env, `tools/illustrations/data/${pad(id)}.json`) : Promise.resolve(null),
    ...solPaths.map((f) => readText(env, f)),
  ]);

  const { slug, html } = doc ? parseProblemDoc(doc) : { slug: null, html: "" };
  let spec: Spec | null = null;
  try {
    spec = specText ? (JSON.parse(specText) as Spec) : null;
  } catch {
    spec = null;
  }

  const history: HistoryFile[] = solPaths.flatMap((f, i) => {
    const src = sols[i];
    if (src == null) return [];
    const lang = f.split("/")[1];
    const parts = f.split("/").pop()!.replace(/\.[^.]+$/, "").split(".");
    const variant = parts.slice(2).join(".");
    return [{ lang, file: f, label: (LANG_LABEL[lang] ?? lang) + (variant ? ` · ${variant}` : ""), code: trimSolution(lang, src) }];
  });
  const order = { java: 0, python: 1, go: 2 } as Record<string, number>;
  history.sort((a, b) => (order[a.lang] ?? 9) - (order[b.lang] ?? 9) || a.file.localeCompare(b.file));

  const ranked = index.problems.slice().sort(byImportance);
  const k = ranked.findIndex((x) => x.id === id);
  const link = (x?: ProblemSummary) => (x ? { id: x.id, name: x.name } : null);

  return {
    summary,
    slug,
    statementHtml: html,
    spec,
    history,
    illustrationUrl: ill ? "/api/raw/" + ill.split("/").map(encodeURIComponent).join("/") : null,
    prev: link(ranked[k - 1]),
    next: link(ranked[k + 1]),
  };
}
