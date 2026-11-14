// 读写用户自己的进度仓（<用户>/hot100-progress）。文件规则和模板仓 README、scripts/check.mjs 是同一套：
//   progress.json：{ version: 1, problems: { "<题号>": { status, updatedAt? } } }
//   solutions/<语言>/<四位题号>.<题名>[.<写法>].<后缀>
//   attempts/<四位题号>.<题名>/<YYYY-MM-DD>.<序号>.<结果>.md

import type { Attempt, AttemptResult, HistoryFile, Status } from "../../lib/types";
import { HttpError } from "./github";

export const LANGS: Record<string, string[]> = {
  python: [".py"], java: [".java"], go: [".go"], cpp: [".cpp", ".cc"], c: [".c"],
  javascript: [".js"], typescript: [".ts"], rust: [".rs"], kotlin: [".kt"], swift: [".swift"], csharp: [".cs"],
};
const LANG_LABEL: Record<string, string> = {
  python: "Python", java: "Java", go: "Go", cpp: "C++", c: "C", javascript: "JavaScript", typescript: "TypeScript",
  rust: "Rust", kotlin: "Kotlin", swift: "Swift", csharp: "C#",
};
export const STATUSES: Status[] = ["已通过", "曾通过", "尝试过", "未开始"];
export const RESULTS: AttemptResult[] = ["通过", "答案错误", "超时", "运行出错", "思路不成立"];

interface ProgressFile {
  version: number;
  problems: Record<string, { status: Status; updatedAt?: string | null }>;
}

const API = "https://api.github.com";
const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (s: string) => { let b = ""; for (const x of enc.encode(s)) b += String.fromCharCode(x); return btoa(b); };
const fromB64 = (s: string) => dec.decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const encPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export async function gh(token: string, method: string, path: string, body?: unknown, accept = "application/vnd.github+json"): Promise<Response> {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      "User-Agent": "lc-hot100-site",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** 解析一个题解文件路径；不符合规则返回 null */
export function parseSolution(p: string): { id: number; lang: string; variant: string } | null {
  const m = p.match(/^solutions\/([a-z]+)\/(\d{4})\.(.+)(\.[A-Za-z0-9]+)$/);
  if (!m || !LANGS[m[1]] || !LANGS[m[1]].includes(m[4])) return null;
  // 热题 100 的题名里没有「.」，第一个「.」之后的部分是写法名
  const rest = m[3], dot = rest.indexOf(".");
  return { id: Number(m[2]), lang: m[1], variant: dot >= 0 ? rest.slice(dot + 1) : "" };
}

/** 解析一个尝试记录的路径；不符合规则返回 null（和 check.mjs 的 parseAttemptPath 一致） */
export function parseAttemptPath(p: string): { id: number; date: string; seq: number; result: AttemptResult } | null {
  const m = p.match(/^attempts\/(\d{4})\.([^/]+)\/(\d{4}-\d{2}-\d{2})\.(\d+)\.([^./]+)\.md$/);
  if (!m || !RESULTS.includes(m[5] as AttemptResult)) return null;
  return { id: Number(m[1]), date: m[3], seq: Number(m[4]), result: m[5] as AttemptResult };
}

/** 解析尝试记录的内容：--- 设置 ---，然后是 ## 小节，「## 代码」里放一个代码块（和 check.mjs 的 parseAttemptBody 一致） */
export function parseAttemptBody(src: string) {
  const errs: string[] = [];
  const text = src.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  const meta: Record<string, string> = {};
  if (!fm) errs.push("开头要有 --- 包起来的设置（至少写 lang）");
  else for (const line of fm[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = line.match(/^([A-Za-z]+):\s*(.*?)\s*(?:#.*)?$/);
    if (!kv) { errs.push(`设置里看不懂这一行：${line}`); continue; }
    meta[kv[1]] = kv[2];
  }
  const lang = meta.lang ?? "";
  if (fm && !LANGS[lang]) errs.push(`lang 要写成语言目录名之一：${Object.keys(LANGS).join(" / ")}`);
  if (meta.verbatim != null && meta.verbatim !== "true" && meta.verbatim !== "false") errs.push("verbatim 只能写 true 或 false");
  const body = fm ? text.slice(fm[0].length) : text;
  const sections: { title: string; text: string }[] = [];
  let code: string | null = null;
  for (const chunk of body.split(/^## +/m).slice(1)) {
    const nl = chunk.indexOf("\n");
    const title = (nl < 0 ? chunk : chunk.slice(0, nl)).trim();
    const content = (nl < 0 ? "" : chunk.slice(nl + 1)).trim();
    if (title === "代码") {
      const c = content.match(/^(`{3,})([^\n`]*)\n([\s\S]*?)\n\1\s*$/);
      if (!c) errs.push("「代码」一节里要放且只放一个 ``` 代码块");
      else code = c[3];
    } else sections.push({ title, text: content });
  }
  // 从力扣同步过来的记录（或补过编号的手写记录）带着这三项
  if (meta.submission != null && !/^\d+$/.test(meta.submission)) errs.push("submission 只能写力扣的提交编号（数字）");
  if (meta.submittedAt != null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(meta.submittedAt)) errs.push("submittedAt 要写成 2026-11-14T10:05:00+08:00 这样");
  const submission = meta.submission && /^\d+$/.test(meta.submission) ? meta.submission : null;
  return {
    lang, verbatim: meta.verbatim !== "false", sections, code, errors: errs,
    source: meta.source || null, submission, submittedAt: meta.submittedAt || null,
  };
}

async function listFiles(token: string, repo: string): Promise<string[]> {
  const r = await gh(token, "GET", `/repos/${repo}/git/trees/HEAD?recursive=1`);
  if (r.status === 404 || r.status === 409) return []; // 仓库不存在或还是空的
  if (!r.ok) throw new HttpError(502, `读取进度仓目录失败（GitHub ${r.status}）`);
  const j = (await r.json()) as { tree: { path: string; type: string }[] };
  return j.tree.filter((e) => e.type === "blob").map((e) => e.path);
}

async function readProgress(token: string, repo: string): Promise<{ data: ProgressFile; sha: string | null }> {
  const r = await gh(token, "GET", `/repos/${repo}/contents/progress.json`);
  if (r.status === 404) return { data: { version: 1, problems: {} }, sha: null };
  if (!r.ok) throw new HttpError(502, `读取 progress.json 失败（GitHub ${r.status}）`);
  const j = (await r.json()) as { content: string; sha: string };
  try {
    const data = JSON.parse(fromB64(j.content)) as ProgressFile;
    if (!data || typeof data.problems !== "object") throw new Error("bad");
    return { data, sha: j.sha };
  } catch {
    throw new HttpError(422, "progress.json 的格式不对，按进度仓 README 里的规则改一下");
  }
}

/** 每道题的状态 + 有哪些语言的题解 */
export async function loadProgress(token: string, repo: string) {
  const [files, { data }] = await Promise.all([listFiles(token, repo), readProgress(token, repo)]);
  const status: Record<string, Status> = {};
  for (const [k, v] of Object.entries(data.problems)) if (STATUSES.includes(v?.status)) status[k] = v.status;
  const langs: Record<string, string[]> = {};
  for (const f of files) {
    const s = parseSolution(f);
    if (!s) continue;
    const k = String(s.id);
    if (!(langs[k] ||= []).includes(s.lang)) langs[k].push(s.lang);
  }
  return { status, langs };
}

/** 改一道题的状态，提交到用户的进度仓。并发改动时 sha 会对不上，重试一次 */
export async function saveStatus(token: string, repo: string, id: number, status: Status) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, sha } = await readProgress(token, repo);
    const key = String(id);
    if (status === "未开始") delete data.problems[key];
    else data.problems[key] = { status, updatedAt: new Date().toISOString().slice(0, 10) };
    // 按题号排好，diff 好看
    const sorted: ProgressFile = { version: 1, problems: {} };
    for (const k of Object.keys(data.problems).sort((a, b) => Number(a) - Number(b))) sorted.problems[k] = data.problems[k];
    const r = await gh(token, "PUT", `/repos/${repo}/contents/progress.json`, {
      message: `进度：第 ${id} 题 → ${status}`,
      content: toB64(JSON.stringify(sorted, null, 2) + "\n"),
      ...(sha ? { sha } : {}),
    });
    if (r.ok) return;
    if (r.status === 403 || r.status === 404) throw new HttpError(403, "网站还没有这个仓库的写权限：先把 GitHub App 装到你的进度仓上");
    if (r.status !== 409 && r.status !== 422) throw new HttpError(502, `保存进度失败（GitHub ${r.status}）`);
  }
  throw new HttpError(409, "进度仓刚被别的地方改过，刷新一下再试");
}

/** LeetCode 插件生成的 Java 文件里，只取 submit region 之间的代码 */
function trimSolution(lang: string, src: string) {
  if (lang === "java") {
    const re = /\/\/[^\n]*?submit (?:code )?region begin[^\n]*\n([\s\S]*?)\/\/[^\n]*?submit (?:code )?region end/gi;
    const parts = [...src.matchAll(re)].map((m) => m[1].replace(/\s+$/, ""));
    if (parts.length) return parts.join("\n\n");
  }
  return src.replace(/\s+$/, "");
}

const readRaw = async (token: string, repo: string, f: string) => {
  const r = await gh(token, "GET", `/repos/${repo}/contents/${encPath(f)}`, undefined, "application/vnd.github.raw+json");
  return r.ok ? r.text() : null;
};

/** 某道题在用户进度仓里的所有题解和尝试记录（共用一次目录读取） */
export async function loadMine(token: string, repo: string, id: number): Promise<{ history: HistoryFile[]; attempts: Attempt[] }> {
  const files = await listFiles(token, repo);
  const [history, attempts] = await Promise.all([loadSolutions(token, repo, id, files), loadAttempts(token, repo, id, files)]);
  return { history, attempts };
}

/** 某道题的尝试记录，按日期、序号排好 */
export async function loadAttempts(token: string, repo: string, id: number, files?: string[]): Promise<Attempt[]> {
  const mine = (files ?? (await listFiles(token, repo))).map((f) => ({ f, a: parseAttemptPath(f) })).filter((x) => x.a?.id === id);
  const out = await Promise.all(mine.map(async ({ f, a }) => {
    const src = await readRaw(token, repo, f);
    if (src == null) return null;
    const b = parseAttemptBody(src);
    return { file: f, date: a!.date, seq: a!.seq, result: a!.result, ...b } satisfies Attempt;
  }));
  return (out.filter(Boolean) as Attempt[]).sort((x, y) => x.date.localeCompare(y.date) || x.seq - y.seq);
}

/** 某道题在用户进度仓里的所有题解 */
export async function loadSolutions(token: string, repo: string, id: number, files?: string[]): Promise<HistoryFile[]> {
  files = (files ?? (await listFiles(token, repo))).filter((f) => parseSolution(f)?.id === id).sort();
  const out = await Promise.all(files.map(async (f) => {
    const text = await readRaw(token, repo, f);
    if (text == null) return null;
    const s = parseSolution(f)!;
    return { lang: s.lang, file: f, label: (LANG_LABEL[s.lang] ?? s.lang) + (s.variant ? ` · ${s.variant}` : ""), code: trimSolution(s.lang, text) };
  }));
  const order = Object.keys(LANGS);
  return (out.filter(Boolean) as HistoryFile[]).sort((a, b) => order.indexOf(a.lang) - order.indexOf(b.lang) || a.file.localeCompare(b.file));
}
