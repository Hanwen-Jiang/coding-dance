// 网站练习区（题目页右侧的编辑器）写进用户自己进度仓的内容。纯逻辑，不碰网络：
// 服务端接口 functions/api/progress/practice.ts 和测试 lib/practice/test/record.test.ts 共用。
// 规则以模板仓 README 为准（和 check.mjs、functions/_lib/progress.ts、lib/sync/core.ts 同一套）：
//   「全量测试」跑完 → 一条尝试记录 attempts/<四位题号>.<题名>/<YYYY-MM-DD>.<序号>.<结果>.md，开头写 source: practice 和 mode；
//   全部通过 → 代码同时存成题解 solutions/<语言>/<四位题号>.<题名>[.ACM].<后缀>（「我的历史题解」）：
//     已有的题解一个都不动——和某份已有题解是同一份代码（codeKey 一样）就不再存，文件名被占了就存成 .2 / .3（ACM 模式 .ACM2 / .ACM3）；
//   「保存」→「存为尝试记录」（手动）：精简测试、示例、自定义用例没通过的那次也能记（scope 写明是哪一种）；
//     「通过」只能来自全量测试（没全量通过的不算通过，状态也不会变成已通过）；
//   「保存」→「存为我的题解」（手动）：不管通没通过都存，没全量通过的写法名标上「未通过」或「未验证」，
//     在「我的历史题解」里看得出来（失败也值得留着）；同一份代码已经存过就不再存；
//   Ctrl+S、自动保存 → 草稿 drafts/<语言>/<四位题号>.<题名>[.ACM].<后缀>，换台电脑也能接着写。
// 路径和文件内容都在这里按规则生成，页面只传代码和测试结果。
import { attemptPath, cnParts, codeKey, fence, nextStatus, parseAttemptPath, writeProgress, type ProgressFile, type Problem, type Result, type StatusName } from "../sync/core.ts";
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
/** 这次跑的是哪一组用例：全量测试 / 精简测试 / 运行示例 / 自定义用例 */
export type RunScope = "full" | "quick" | "sample" | "custom";
const SCOPES: RunScope[] = ["full", "quick", "sample", "custom"];
const SCOPE_LABEL: Record<RunScope, string> = { full: "全量测试", quick: "精简测试", sample: "运行示例", custom: "自定义用例" };
/** 手动存成题解时写法名上的标记：全量通过的不标 */
export type SolutionLabel = "通过" | "未通过" | "未验证";
const LABELS: SolutionLabel[] = ["通过", "未通过", "未验证"];

export interface DraftSave { kind: "draft"; id: number; lang: string; mode: PracticeMode; code: string }
export interface RunSave {
  kind: "run"; id: number; lang: string; mode: PracticeMode; code: string;
  result: Result; passed: number; total: number; duration: number;
  /** 没通过的用例说明（输入、预期、实际或报错），每条一行，最多 5 条 */
  notes: string[];
  /** 哪一组用例（以前只记全量测试，没有这个字段的当作全量） */
  scope: RunScope;
  /** 用户点「存为尝试记录」记的（全量测试是跑完自动记的） */
  manual: boolean;
}
export interface SolutionSave { kind: "solution"; id: number; lang: string; mode: PracticeMode; code: string; label: SolutionLabel }
export type PracticeSave = DraftSave | RunSave | SolutionSave;

/** 一行文字：换行和多余空白收成一个空格，去掉开头的 #（免得变成 Markdown 标题），最长 400 字 */
const oneLine = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim().replace(/^#+\s*/, "");
  return t.length > 400 ? `${t.slice(0, 399)}…` : t;
};

/** 检查页面传来的内容；不对就整个拒绝 */
export function validateSave(body: unknown): PracticeSave {
  const b = body as Record<string, unknown> | null;
  if (!b || (b.kind !== "draft" && b.kind !== "run" && b.kind !== "solution")) throw new SyncError("参数不对：kind");
  const id = Number(b.id);
  if (!Number.isInteger(id) || id < 1 || id > 9999) throw new SyncError("参数不对：id");
  if (typeof b.lang !== "string" || !PRACTICE_EXT[b.lang]) throw new SyncError("参数不对：lang");
  if (b.mode !== "leetcode" && b.mode !== "acm") throw new SyncError("参数不对：mode");
  if (typeof b.code !== "string" || !b.code.trim()) throw new SyncError("参数不对：code");
  if (b.code.length > MAX_CODE) throw new SyncError("代码太长了（最多 100 KB）");
  const base = { id, lang: b.lang, mode: b.mode as PracticeMode, code: b.code };
  if (b.kind === "draft") return { kind: "draft", ...base };
  if (b.kind === "solution") {
    if (!LABELS.includes(b.label as SolutionLabel)) throw new SyncError("参数不对：label");
    return { kind: "solution", ...base, label: b.label as SolutionLabel };
  }
  if (!RESULTS.includes(b.result as Result)) throw new SyncError("参数不对：result");
  const passed = Number(b.passed), total = Number(b.total), duration = Number(b.duration);
  if (!Number.isInteger(total) || total < 1 || total > 1000 || !Number.isInteger(passed) || passed < 0 || passed > total) throw new SyncError("参数不对：passed / total");
  if ((b.result === "通过") !== (passed === total)) throw new SyncError("参数不对：全部通过才记「通过」");
  const scope = b.scope === undefined ? "full" : (b.scope as RunScope);
  if (!SCOPES.includes(scope)) throw new SyncError("参数不对：scope");
  if (scope !== "full" && b.result === "通过") throw new SyncError("参数不对：只有全量测试全部通过才记「通过」");
  const notes = Array.isArray(b.notes) ? b.notes.filter((x): x is string => typeof x === "string").slice(0, 5).map(oneLine).filter(Boolean) : [];
  return { kind: "run", ...base, result: b.result as Result, passed, total, duration: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : 0, notes, scope, manual: b.manual === true };
}

const pad4 = (n: number) => String(n).padStart(4, "0");
const variant = (mode: PracticeMode) => (mode === "acm" ? ".ACM" : "");
/** 代码统一成 \n 换行、去掉末尾空白，再补一个换行 */
const tidy = (code: string) => code.replace(/\r\n?/g, "\n").replace(/\s+$/, "") + "\n";

export const draftPath = (p: Pick<Problem, "id" | "name">, lang: string, mode: PracticeMode) => `drafts/${lang}/${pad4(p.id)}.${p.name}${variant(mode)}${PRACTICE_EXT[lang]}`;
export const solutionPath = (p: Pick<Problem, "id" | "name">, lang: string, mode: PracticeMode) => `solutions/${lang}/${pad4(p.id)}.${p.name}${variant(mode)}${PRACTICE_EXT[lang]}`;

/** 仓库里这道题这种语言的所有题解（任何写法，包括手写的、从别处存的） */
export function existingSolutions(paths: string[], id: number, lang: string) {
  const ext = PRACTICE_EXT[lang];
  if (!ext) return [];
  const re = new RegExp(`^solutions/${lang}/${pad4(id)}\\.[^./]+(\\.[^./]+)?\\${ext}$`);
  return paths.filter((p) => re.test(p));
}

/**
 * 全部通过时题解存到哪里；返回 undefined 表示不用存。
 * solutions：existingSolutions 列出的文件 → 内容（读不到的当作代码不一样）。
 */
export function pickSolutionPath(p: Pick<Problem, "id" | "name">, lang: string, mode: PracticeMode, code: string, paths: string[], solutions: Record<string, string>) {
  const mine = existingSolutions(paths, p.id, lang);
  const key = codeKey(code);
  if (mine.some((f) => solutions[f] != null && codeKey(solutions[f]) === key)) return undefined;
  const taken = new Set(paths);
  const base = solutionPath(p, lang, mode);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const next = `solutions/${lang}/${pad4(p.id)}.${p.name}.${mode === "acm" ? "ACM" : ""}${n}${PRACTICE_EXT[lang]}`;
    if (!taken.has(next)) return next;
  }
}

/**
 * 手动「存为我的题解」时存到哪里；返回 undefined 表示同一份代码已经存过（任何写法名）。
 * 全量通过的（label 通过）和自动存的一样（pickSolutionPath）；没通过的写法名标上 label：
 * 0001.两数之和.未通过.py，被占了 .未通过2；ACM 模式 0001.两数之和.ACM未通过.py（写法名只有一段）。
 */
export function pickLabeledSolutionPath(p: Pick<Problem, "id" | "name">, lang: string, mode: PracticeMode, code: string, label: SolutionLabel, paths: string[], solutions: Record<string, string>) {
  if (label === "通过") return pickSolutionPath(p, lang, mode, code, paths, solutions);
  const key = codeKey(code);
  if (existingSolutions(paths, p.id, lang).some((f) => solutions[f] != null && codeKey(solutions[f]) === key)) return undefined;
  const taken = new Set(paths);
  const tag = `${mode === "acm" ? "ACM" : ""}${label}`;
  for (let n = 1; ; n++) {
    const next = `solutions/${lang}/${pad4(p.id)}.${p.name}.${tag}${n === 1 ? "" : n}${PRACTICE_EXT[lang]}`;
    if (!taken.has(next)) return next;
  }
}

/** 不知道题名时按题号找草稿：drafts/<语言>/<四位题号>.<任意题名>[.ACM].<后缀>（热题 100 的题名里没有「.」） */
export function findDraft(paths: string[], id: number, lang: string, mode: PracticeMode) {
  const ext = PRACTICE_EXT[lang];
  if (!ext) return null;
  const re = new RegExp(`^drafts/${lang}/${pad4(id)}\\.[^./]+${mode === "acm" ? "\\.ACM" : ""}\\${ext}$`);
  return paths.find((p) => re.test(p)) ?? null;
}

/** 练习区写成的尝试记录（全量测试自动记的，或者用户手动记的那一次运行） */
export function renderPracticeAttempt(s: RunSave, at: { date: string; time: string }) {
  const code = tidy(s.code).replace(/\n$/, "");
  const f = fence(code);
  const head = s.result === "通过" ? `全部通过（${s.total} 个用例）` : `${s.result}：通过 ${s.passed} / ${s.total} 个用例`;
  const how = `网站练习区「${SCOPE_LABEL[s.scope]}」${s.manual ? "，手动保存" : ""}`;
  return [
    "---", `lang: ${s.lang}`, "verbatim: true", `source: ${PRACTICE_SOURCE}`, `mode: ${s.mode}`, `ranAt: ${at.date}T${at.time}+08:00`, "---",
    "", "## 代码", "", `${f}${s.lang}`, code, f,
    "", "## 测试结果", "", `${how}，${s.mode === "acm" ? "ACM 模式" : "力扣模式"} · ${head}${s.duration ? ` · 用时 ${s.duration} ms` : ""}`,
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
 * 要写哪些文件。paths：仓库里现有的文件（算当天的序号）；progress：现在的 progress.json；now：毫秒时间戳；
 * solutions：这道题这种语言已有题解的内容（见 existingSolutions；全部通过时用来判断要不要另存）。
 * 日期按北京时间算，和从力扣同步的记录一致。状态只升不降（规则和同步一样，见 core.ts 的 nextStatus）。
 */
export function planSave(s: PracticeSave, ctx: { problem: Problem; paths: string[]; progress: ProgressFile | null; now: number; solutions?: Record<string, string> }): SavePlan {
  const { problem } = ctx;
  const what = `第 ${problem.id} 题 ${problem.name} · ${LABEL[s.lang]}${s.mode === "acm" ? "（ACM）" : ""}`;
  if (s.kind === "draft") return { files: [{ path: draftPath(problem, s.lang, s.mode), content: tidy(s.code) }], message: `练习草稿：${what}` };
  if (s.kind === "solution") {
    // 只存题解，不记尝试、不改状态（状态只看尝试记录）
    const solution = pickLabeledSolutionPath(problem, s.lang, s.mode, s.code, s.label, ctx.paths, ctx.solutions ?? {});
    return { files: solution ? [{ path: solution, content: tidy(s.code) }] : [], message: `练习：${what} · 存为我的题解（${s.label}）`, solution };
  }
  const at = cnParts(Math.floor(ctx.now / 1000));
  let seq = 0;
  for (const p of ctx.paths) { const a = parseAttemptPath(p); if (a && a.id === problem.id && a.date === at.date) seq = Math.max(seq, a.seq); }
  const attempt = attemptPath(problem, at.date, seq + 1, s.result);
  const files = [{ path: attempt, content: renderPracticeAttempt(s, at) }];
  const solution = s.result === "通过" ? pickSolutionPath(problem, s.lang, s.mode, s.code, ctx.paths, ctx.solutions ?? {}) : undefined;
  if (solution) files.push({ path: solution, content: tidy(s.code) });
  const progress: ProgressFile = ctx.progress ?? { version: 1, problems: {} };
  const next = nextStatus(progress.problems?.[String(problem.id)], [{ result: s.result, date: at.date }]);
  if (next) files.push({ path: "progress.json", content: writeProgress(progress, new Map([[problem.id, next]])) });
  const scope = s.scope === "full" ? "" : ` · ${SCOPE_LABEL[s.scope]}`;
  return { files, message: `练习：${what} · ${s.result}（${s.passed}/${s.total}）${scope}${s.manual ? " · 手动保存" : ""}`, attempt, solution, status: next?.status };
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
