// 网站练习区（题目页右侧的编辑器）写进用户自己进度仓的内容。纯逻辑，不碰网络：
// 服务端接口 functions/api/progress/practice.ts 和测试 lib/practice/test/record.test.ts 共用。
// 规则以模板仓 README 为准（和 check.mjs、functions/_lib/progress.ts、lib/sync/core.ts 同一套）：
//   「测试全部」跑完 → 一条尝试记录 attempts/<四位题号>.<题名>/<YYYY-MM-DD>.<序号>.<结果>.md，开头写 source: practice 和 mode；
//   全部通过 → 代码同时存成题解 solutions/<语言>/<四位题号>.<题名>[.ACM].<后缀>（「我的历史题解」）；
//   Ctrl+S、自动保存 → 草稿 drafts/<语言>/<四位题号>.<题名>[.ACM].<后缀>，换台电脑也能接着写。
// 路径和文件内容都在这里按规则生成，页面只传代码和测试结果。
import { attemptPath, cnParts, fence, nextStatus, parseAttemptPath, writeProgress, type ProgressFile, type Problem, type Result, type StatusName } from "../sync/core.ts";
import { SyncError } from "../sync/server.ts";

/** 练习区能跑的语言 → 进度仓里的后缀 */
export const PRACTICE_EXT: Record<string, string> = { python: ".py", javascript: ".js", typescript: ".ts" };
const LABEL: Record<string, string> = { python: "Python", javascript: "JavaScript", typescript: "TypeScript" };
/** 练习区的尝试记录开头写的来源；从力扣同步时不拿它们去和力扣提交对（结果是按本站用例判的，不是力扣的判题结果） */
export const PRACTICE_SOURCE = "practice";
/** 练习区判得出来的四种结果（「思路不成立」只能手写） */
const RESULTS: Result[] = ["通过", "答案错误", "超时", "运行出错"];
const MAX_CODE = 100_000;

export type PracticeMode = "leetcode" | "acm";
export interface DraftSave { kind: "draft"; id: number; lang: string; mode: PracticeMode; code: string }
export interface RunSave {
  kind: "run"; id: number; lang: string; mode: PracticeMode; code: string;
  result: Result; passed: number; total: number; duration: number;
  /** 没通过的用例说明（输入、预期、实际或报错），每条一行，最多 5 条 */
  notes: string[];
}
export type PracticeSave = DraftSave | RunSave;

/** 一行文字：换行和多余空白收成一个空格，去掉开头的 #（免得变成 Markdown 标题），最长 400 字 */
const oneLine = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim().replace(/^#+\s*/, "");
  return t.length > 400 ? `${t.slice(0, 399)}…` : t;
};

/** 检查页面传来的内容；不对就整个拒绝 */
export function validateSave(body: unknown): PracticeSave {
  const b = body as Record<string, unknown> | null;
  if (!b || (b.kind !== "draft" && b.kind !== "run")) throw new SyncError("参数不对：kind");
  const id = Number(b.id);
  if (!Number.isInteger(id) || id < 1 || id > 9999) throw new SyncError("参数不对：id");
  if (typeof b.lang !== "string" || !PRACTICE_EXT[b.lang]) throw new SyncError("参数不对：lang");
  if (b.mode !== "leetcode" && b.mode !== "acm") throw new SyncError("参数不对：mode");
  if (typeof b.code !== "string" || !b.code.trim()) throw new SyncError("参数不对：code");
  if (b.code.length > MAX_CODE) throw new SyncError("代码太长了（最多 100 KB）");
  const base = { id, lang: b.lang, mode: b.mode as PracticeMode, code: b.code };
  if (b.kind === "draft") return { kind: "draft", ...base };
  if (!RESULTS.includes(b.result as Result)) throw new SyncError("参数不对：result");
  const passed = Number(b.passed), total = Number(b.total), duration = Number(b.duration);
  if (!Number.isInteger(total) || total < 1 || total > 1000 || !Number.isInteger(passed) || passed < 0 || passed > total) throw new SyncError("参数不对：passed / total");
  if ((b.result === "通过") !== (passed === total)) throw new SyncError("参数不对：全部通过才记「通过」");
  const notes = Array.isArray(b.notes) ? b.notes.filter((x): x is string => typeof x === "string").slice(0, 5).map(oneLine).filter(Boolean) : [];
  return { kind: "run", ...base, result: b.result as Result, passed, total, duration: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : 0, notes };
}

const pad4 = (n: number) => String(n).padStart(4, "0");
const variant = (mode: PracticeMode) => (mode === "acm" ? ".ACM" : "");
/** 代码统一成 \n 换行、去掉末尾空白，再补一个换行 */
const tidy = (code: string) => code.replace(/\r\n?/g, "\n").replace(/\s+$/, "") + "\n";

export const draftPath = (p: Pick<Problem, "id" | "name">, lang: string, mode: PracticeMode) => `drafts/${lang}/${pad4(p.id)}.${p.name}${variant(mode)}${PRACTICE_EXT[lang]}`;
export const solutionPath = (p: Pick<Problem, "id" | "name">, lang: string, mode: PracticeMode) => `solutions/${lang}/${pad4(p.id)}.${p.name}${variant(mode)}${PRACTICE_EXT[lang]}`;

/** 不知道题名时按题号找草稿：drafts/<语言>/<四位题号>.<任意题名>[.ACM].<后缀>（热题 100 的题名里没有「.」） */
export function findDraft(paths: string[], id: number, lang: string, mode: PracticeMode) {
  const ext = PRACTICE_EXT[lang];
  if (!ext) return null;
  const re = new RegExp(`^drafts/${lang}/${pad4(id)}\\.[^./]+${mode === "acm" ? "\\.ACM" : ""}\\${ext}$`);
  return paths.find((p) => re.test(p)) ?? null;
}

/** 「测试全部」写成的尝试记录 */
export function renderPracticeAttempt(s: RunSave, at: { date: string; time: string }) {
  const code = tidy(s.code).replace(/\n$/, "");
  const f = fence(code);
  const head = s.result === "通过" ? `全部通过（${s.total} 个用例）` : `${s.result}：通过 ${s.passed} / ${s.total} 个用例`;
  return [
    "---", `lang: ${s.lang}`, "verbatim: true", `source: ${PRACTICE_SOURCE}`, `mode: ${s.mode}`, `ranAt: ${at.date}T${at.time}+08:00`, "---",
    "", "## 代码", "", `${f}${s.lang}`, code, f,
    "", "## 测试结果", "", `网站练习区「测试全部」，${s.mode === "acm" ? "ACM 模式" : "力扣模式"} · ${head}${s.duration ? ` · 用时 ${s.duration} ms` : ""}`,
    ...(s.notes.length ? ["", ...s.notes.map((n) => `- ${n}`)] : []),
    "", "用例是本站的判题用例，结果不代表力扣的判题。", "",
  ].join("\n");
}

export interface SavePlan {
  files: { path: string; content: string }[];
  message: string;
  /** 新写的尝试记录、题解（run 才有） */
  attempt?: string;
  solution?: string;
  /** 这道题的状态变成了什么；没变是 undefined */
  status?: StatusName;
}

/**
 * 要写哪些文件。paths：仓库里现有的文件（算当天的序号）；progress：现在的 progress.json；now：毫秒时间戳。
 * 日期按北京时间算，和从力扣同步的记录一致。状态只升不降（规则和同步一样，见 core.ts 的 nextStatus）。
 */
export function planSave(s: PracticeSave, ctx: { problem: Problem; paths: string[]; progress: ProgressFile | null; now: number }): SavePlan {
  const { problem } = ctx;
  const what = `第 ${problem.id} 题 ${problem.name} · ${LABEL[s.lang]}${s.mode === "acm" ? "（ACM）" : ""}`;
  if (s.kind === "draft") return { files: [{ path: draftPath(problem, s.lang, s.mode), content: tidy(s.code) }], message: `练习草稿：${what}` };
  const at = cnParts(Math.floor(ctx.now / 1000));
  let seq = 0;
  for (const p of ctx.paths) { const a = parseAttemptPath(p); if (a && a.id === problem.id && a.date === at.date) seq = Math.max(seq, a.seq); }
  const attempt = attemptPath(problem, at.date, seq + 1, s.result);
  const files = [{ path: attempt, content: renderPracticeAttempt(s, at) }];
  const solution = s.result === "通过" ? solutionPath(problem, s.lang, s.mode) : undefined;
  if (solution) files.push({ path: solution, content: tidy(s.code) });
  const progress: ProgressFile = ctx.progress ?? { version: 1, problems: {} };
  const next = nextStatus(progress.problems?.[String(problem.id)], [{ result: s.result, date: at.date }]);
  if (next) files.push({ path: "progress.json", content: writeProgress(progress, new Map([[problem.id, next]])) });
  return { files, message: `练习：${what} · ${s.result}（${s.passed}/${s.total}）`, attempt, solution, status: next?.status };
}

/** git 的 blob sha（sha1("blob <字节数>\0" + 内容)）：内容和仓库里一样的文件不再写 */
export async function gitBlobSha(content: string) {
  const body = new TextEncoder().encode(content);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head); all.set(body, head.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", all));
  return [...hash].map((x) => x.toString(16).padStart(2, "0")).join("");
}
