// 纯逻辑：把力扣的提交记录变成进度仓里的文件。不碰网络，网站的同步页、服务端接口和测试共用。
// 文件规则以模板仓 README 为准，和 functions/_lib/progress.ts、模板仓 scripts/check.mjs 是同一套。

export type Result = "通过" | "答案错误" | "超时" | "运行出错" | "思路不成立";
export type StatusName = "已通过" | "曾通过" | "尝试过" | "未开始";

export interface Problem { id: number; name: string; slug: string }
/** submissionList 里的一次提交 */
export interface Sub {
  id: string | number; status: string; statusDisplay?: string; lang: string; langVerboseName?: string;
  runtime?: string; memory?: string; timestamp: string | number; isPending?: string;
}
/** submissionDetail */
export interface Detail {
  code?: string | null; lang?: string; runtime?: string; memory?: string;
  passedTestCaseCnt?: number; totalTestCaseCnt?: number; runtimePercentile?: number; memoryPercentile?: number;
}
export interface SubWithDetail { sub: Sub; detail: Detail }
export interface NewFile { path: string; content: string; id: string; date: string; result: Result }
export interface Skipped { sub: Sub; reason: string }
export interface ProgressEntry { status: StatusName; updatedAt?: string | null }
export interface ProgressFile { version: number; problems: Record<string, ProgressEntry> }

/** 力扣的语言 → 进度仓的语言目录。不在这里的语言不同步 */
export const LC_LANG: Record<string, string> = {
  python3: "python", python: "python", java: "java", cpp: "cpp", c: "c", golang: "go",
  javascript: "javascript", typescript: "typescript", rust: "rust", kotlin: "kotlin", swift: "swift", csharp: "csharp",
};
const LANG_DIRS = new Set(Object.values(LC_LANG));
export const RESULTS: Result[] = ["通过", "答案错误", "超时", "运行出错", "思路不成立"];
export const STATUSES: StatusName[] = ["已通过", "曾通过", "尝试过", "未开始"];

/** 力扣的判题结果 → 进度仓的结果（文件名里的那一段） */
export const resultOf = (code: string): Result => (code === "AC" ? "通过" : code === "WA" ? "答案错误" : code === "TLE" ? "超时" : "运行出错");

/** 力扣的判题结果 → 页面上显示的中文 */
export const STATUS_TEXT: Record<string, string> = {
  AC: "通过", WA: "解答错误", TLE: "超出时间限制", MLE: "超出内存限制", OLE: "超出输出限制",
  RE: "执行出错", CE: "编译出错", IE: "内部出错",
};

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** 力扣中国站按北京时间算日期 */
export function cnParts(ts: string | number) {
  const d = new Date((Number(ts) + 8 * 3600) * 1000);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
  };
}
export const submittedAt = (ts: string | number) => { const p = cnParts(ts); return `${p.date}T${p.time}+08:00`; };

/** 代码块的围栏要比代码里最长的一串反引号还长 */
export function fence(code: string) {
  const runs = code.match(/`+/g) || [];
  return "`".repeat(Math.max(3, ...runs.map((r) => r.length + 1)));
}

/** 尝试记录的路径；和 check.mjs 的 parseAttemptPath 一致 */
export function parseAttemptPath(p: string) {
  const m = p.match(/^attempts\/(\d{4})\.([^/]+)\/(\d{4}-\d{2}-\d{2})\.(\d+)\.([^./]+)\.md$/);
  if (!m || !RESULTS.includes(m[5] as Result)) return null;
  return { id: Number(m[1]), name: m[2], date: m[3], seq: Number(m[4]), result: m[5] as Result };
}
export const attemptPath = (problem: Problem, date: string, seq: number, result: Result) => `attempts/${pad(problem.id, 4)}.${problem.name}/${date}.${seq}.${result}.md`;

const unify = (text: string) => text.replace(/^﻿/, "").replace(/\r\n/g, "\n");

/** 读尝试记录开头 --- 里的设置 */
export function frontMatter(text: string) {
  const m = unify(text).match(/^---\n([\s\S]*?)\n---\n/);
  const meta: Record<string, string> = {};
  if (m) for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*?)\s*(?:#.*)?$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return meta;
}

/** 「## 代码」一节里的代码；没有或格式不对时是 null */
function codeOf(text: string) {
  for (const chunk of unify(text).split(/^## +/m).slice(1)) {
    const nl = chunk.indexOf("\n");
    if ((nl < 0 ? chunk : chunk.slice(0, nl)).trim() !== "代码") continue;
    const c = (nl < 0 ? "" : chunk.slice(nl + 1)).trim().match(/^(`{3,})([^\n`]*)\n([\s\S]*?)\n\1\s*$/);
    return c ? c[3] : undefined; // undefined：有这一节但格式不对
  }
  return null;
}

/** 读一条尝试记录里和匹配有关的部分 */
export function readAttempt(text: string) {
  const meta = frontMatter(text);
  return { submission: meta.submission || null, submittedAt: meta.submittedAt || null, verbatim: meta.verbatim !== "false", code: codeOf(text) ?? null };
}

/** 一条尝试记录的格式问题（和 check.mjs、progress.ts 的检查一致）；没问题返回空数组 */
export function validateAttempt(text: string) {
  const errs: string[] = [];
  const t = unify(text);
  const fm = t.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) return ["开头要有 --- 包起来的设置（至少写 lang）"];
  for (const line of fm[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^([A-Za-z]+):\s*(.*?)\s*(?:#.*)?$/.test(line)) errs.push(`设置里看不懂这一行：${line}`);
  }
  const meta = frontMatter(t);
  if (!LANG_DIRS.has(meta.lang ?? "")) errs.push("lang 要写成语言目录名之一");
  if (meta.verbatim != null && meta.verbatim !== "true" && meta.verbatim !== "false") errs.push("verbatim 只能写 true 或 false");
  if (meta.submission != null && !/^\d+$/.test(meta.submission)) errs.push("submission 只能写力扣的提交编号（数字）");
  if (meta.submittedAt != null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(meta.submittedAt)) errs.push("submittedAt 格式不对");
  if (codeOf(t) === undefined) errs.push("「代码」一节里要放且只放一个 ``` 代码块");
  return errs;
}

/** 比较代码时忽略换行符、行尾空白和首尾空行 */
export const normCode = (s: string | null | undefined) => String(s ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();

/**
 * 判断「是不是同一份代码」用的指纹：去掉只有注释的行（力扣会自带 # Definition for a binary tree node 这类注释头），
 * 再去掉所有空白（手抄时常会顺手改空格）。剩下的字符一样，就认为是同一次提交。
 */
export const codeKey = (s: string | null | undefined) => normCode(s).split("\n").filter((l) => !/^\s*(#|\/\/|\/\*|\*\/|\*(\s|$))/.test(l)).join("").replace(/\s+/g, "");

/** 给手写的记录补上力扣的提交编号：只在开头的设置里加三行，其余内容一个字不动 */
export function addSubmissionMeta(text: string, sub: Sub) {
  const lines = ["source: leetcode.cn", `submission: ${sub.id}`, `submittedAt: ${submittedAt(sub.timestamp)}`];
  const eol = /\r\n/.test(text) ? "\r\n" : "\n";
  const m = text.match(/^(﻿?---\r?\n[\s\S]*?)(\r?\n---\r?\n)/);
  if (m) return m[1] + eol + lines.join(eol) + m[2] + text.slice(m[0].length);
  return ["---", ...lines, "---", ""].join(eol) + text;
}

const dayGap = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

export interface Unlabeled { path: string; code: string | null; verbatim: boolean; date?: string; result?: Result; seq?: number }

/**
 * 仓库里没写提交编号的记录（多半是手写的）和力扣提交对上：
 * 先按代码（同一道题里 codeKey 一样就是同一次提交；有几次一样时，优先结果相同、日期相差不到一天、更早的那次）；
 * 再把标了 verbatim: false 的记录按「同一天、同一结果」对上（日期可能是按 UTC 取的，允许差一天）。
 * 对上的不再导入，只给那条记录补上编号。返回 Map(记录路径 → 力扣提交)。
 */
export function matchExisting(unlabeled: Unlabeled[], subs: SubWithDetail[]) {
  const pairs = new Map<string, Sub>(), used = new Set<string>();
  const byTime = [...subs].sort((a, b) => Number(a.sub.timestamp) - Number(b.sub.timestamp));
  for (const f of unlabeled) {
    if (f.code == null) continue;
    const want = codeKey(f.code);
    if (!want) continue;
    const cands = byTime.filter((s) => !used.has(String(s.sub.id)) && s.detail?.code != null && codeKey(s.detail.code) === want);
    const score = (s: SubWithDetail) => (f.result && resultOf(s.sub.status) === f.result ? 0 : 2) + (f.date && dayGap(cnParts(s.sub.timestamp).date, f.date) <= 1 ? 0 : 1);
    const hit = cands.sort((a, b) => score(a) - score(b))[0]; // sort 是稳定的：分数一样时还是更早的在前
    if (hit) { pairs.set(f.path, hit.sub); used.add(String(hit.sub.id)); }
  }
  for (const f of unlabeled.filter((x) => !pairs.has(x.path) && !x.verbatim && x.date && x.result).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))) {
    const free = byTime.filter((s) => !used.has(String(s.sub.id)) && resultOf(s.sub.status) === f.result);
    const hit = free.find((s) => cnParts(s.sub.timestamp).date === f.date) || free.find((s) => dayGap(cnParts(s.sub.timestamp).date, f.date!) <= 1);
    if (hit) { pairs.set(f.path, hit.sub); used.add(String(hit.sub.id)); }
  }
  return pairs;
}

/** 一次力扣提交写成的尝试记录 */
export function renderAttempt({ problem, sub, detail }: { problem: Problem } & SubWithDetail) {
  const lang = LC_LANG[detail.lang || sub.lang];
  const code = String(detail.code ?? "").replace(/\r\n/g, "\n").replace(/\s+$/, "");
  const f = fence(code);
  const parts = [STATUS_TEXT[sub.status] || sub.statusDisplay || sub.status];
  if (detail.totalTestCaseCnt) parts.push(`用例 ${detail.passedTestCaseCnt} / ${detail.totalTestCaseCnt}`);
  if (sub.status === "AC") {
    const pct = (x?: number) => (Number(x) > 0 ? `（击败 ${Number(x).toFixed(1)}%）` : "");
    if (detail.runtime && detail.runtime !== "N/A") parts.push(`执行用时 ${detail.runtime}${pct(detail.runtimePercentile)}`);
    if (detail.memory && detail.memory !== "N/A") parts.push(`内存 ${detail.memory}${pct(detail.memoryPercentile)}`);
  }
  return [
    "---", `lang: ${lang}`, "verbatim: true", "source: leetcode.cn", `submission: ${sub.id}`, `submittedAt: ${submittedAt(sub.timestamp)}`, "---",
    "", "## 代码", "", `${f}${lang}`, code, f,
    "", "## 力扣结果", "", parts.join(" · "),
    "", `https://leetcode.cn/problems/${problem.slug}/submissions/${sub.id}/`, "",
  ].join("\n");
}

/**
 * 一道题要新增的尝试记录。
 * existing：这道题已有的尝试记录路径；known：不用再导入的力扣提交编号；subs：力扣上的提交（带 detail）。
 * 同一天的序号接着已有的往后排，新导入的按提交时间先后编号。
 */
export function planProblem({ problem, existing, known, subs }: { problem: Problem; existing: string[]; known: Set<string>; subs: SubWithDetail[] }) {
  const files: NewFile[] = [], skipped: Skipped[] = [];
  const maxSeq: Record<string, number> = {};
  for (const p of existing) { const a = parseAttemptPath(p); if (a) maxSeq[a.date] = Math.max(maxSeq[a.date] || 0, a.seq); }
  const todo = subs
    .filter((s) => !known.has(String(s.sub.id)))
    .sort((a, b) => Number(a.sub.timestamp) - Number(b.sub.timestamp) || Number(a.sub.id) - Number(b.sub.id));
  for (const s of todo) {
    if (s.sub.isPending && s.sub.isPending !== "Not Pending") { skipped.push({ sub: s.sub, reason: "还在判题" }); continue; }
    if (!LC_LANG[s.detail?.lang || s.sub.lang]) { skipped.push({ sub: s.sub, reason: `进度仓不支持的语言 ${s.sub.langVerboseName || s.sub.lang}` }); continue; }
    if (s.detail?.code == null) { skipped.push({ sub: s.sub, reason: "取不到代码" }); continue; }
    const { date } = cnParts(s.sub.timestamp);
    const seq = (maxSeq[date] = (maxSeq[date] || 0) + 1);
    const result = resultOf(s.sub.status);
    files.push({ path: attemptPath(problem, date, seq, result), content: renderAttempt({ problem, ...s }), id: String(s.sub.id), date, result });
  }
  return { files, skipped };
}

/**
 * 导入之后这道题的状态。只升不降：
 * 没记录 / 尝试过 → 有通过就记「已通过」，否则「尝试过」；「曾通过」只有在记下这个状态之后又通过了才改成「已通过」；「已通过」不动。
 * 返回新的 { status, updatedAt }，不用改时返回 null。
 */
export function nextStatus(cur: ProgressEntry | undefined, imported: { result: Result; date: string }[]): ProgressEntry | null {
  if (!imported.length) return null;
  const ac = imported.filter((f) => f.result === "通过").map((f) => f.date).sort();
  const lastAc = ac[ac.length - 1], last = imported.map((f) => f.date).sort().pop()!;
  const status = cur?.status || "未开始";
  if (status === "已通过") return null;
  if (status === "曾通过") return lastAc && cur?.updatedAt && lastAc > cur.updatedAt ? { status: "已通过", updatedAt: lastAc } : null;
  if (lastAc) return { status: "已通过", updatedAt: lastAc };
  if (status === "尝试过") return null;
  return { status: "尝试过", updatedAt: last };
}

/** 用户说过不要从力扣导入的提交：attempts/skip.txt，一行一个编号，# 后面是注释 */
export const SKIP_FILE = "attempts/skip.txt";
export const parseSkip = (text: string | null | undefined) => new Set(String(text || "").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter((l) => /^\d+$/.test(l)));
export function writeSkip(text: string | null, ids: string[]) {
  const head = text && text.trim() ? text.replace(/\s*$/, "\n") : "# 不要从力扣导入的提交编号，一行一个。同步时会跳过这些提交；删掉一行，下次同步就会重新列出来。\n";
  const have = parseSkip(text);
  return head + ids.filter((id) => !have.has(String(id))).map((id) => `${id}\n`).join("");
}
export const validSkip = (text: string) => text.split(/\r?\n/).every((l) => { const x = l.replace(/#.*/, "").trim(); return !x || /^\d+$/.test(x); });

/** 写回 progress.json：按题号排好，2 空格缩进，和网站写的格式一样 */
export function writeProgress(data: ProgressFile, changes: Map<number, ProgressEntry>) {
  const problems: Record<string, ProgressEntry> = { ...(data.problems || {}) };
  for (const [id, v] of changes) problems[String(id)] = v;
  const sorted: ProgressFile = { version: 1, problems: {} };
  for (const k of Object.keys(problems).sort((a, b) => Number(a) - Number(b))) sorted.problems[k] = problems[k];
  return JSON.stringify(sorted, null, 2) + "\n";
}
