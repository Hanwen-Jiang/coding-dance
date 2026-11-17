// 练习里「测试全部」的结果写进用户自己的进度仓：一条尝试记录；全部通过时另存一份题解（和已有的题解代码一样就不存）；
// 题目状态只升不降。文件路径和内容都在这里按进度仓的规则生成，网页只传代码和运行结果，写不了别的文件。
// 只被 functions/api/practice/record.ts 调用；测试见 lib/practice/test/record.test.ts。
import { SITE_SOURCE, attemptPath, codeKey, fence, nextStatus, parseAttemptPath, writeProgress, type ProgressFile, type Result } from "../sync/core.ts";
import { type Api, SyncError, commitWrites, readBlobs, readRepo } from "../sync/server.ts";

/** 练习支持的语言 → 题解后缀 */
export const RECORD_EXT = { python: "py", javascript: "js", typescript: "ts" } as const;
export type RecordLanguage = keyof typeof RECORD_EXT;
const RECORD_RESULTS: Result[] = ["通过", "答案错误", "超时", "运行出错"];

export interface RecordFailure { label: string; input: string; expected: string; actual: string; error?: string }
export interface RecordInput {
  id: number;
  language: RecordLanguage;
  mode: "leetcode" | "acm";
  code: string;
  result: Result;
  passed: number;
  total: number;
  durationMs: number;
  /** 没通过的用例，最多 3 组 */
  failures: RecordFailure[];
}

const short = (s: unknown, n = 300) => { const t = String(s ?? "").replace(/\r\n/g, "\n"); return t.length > n ? t.slice(0, n) + "…" : t; };

/** 检查网页传来的内容；不对就抛 SyncError(400) */
export function validateRecordInput(body: unknown): RecordInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const int = (v: unknown, max: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
  if (!int(b.id, 9999) || !b.id) throw new SyncError("参数不对：id");
  if (typeof b.language !== "string" || !(b.language in RECORD_EXT)) throw new SyncError("参数不对：language");
  if (b.mode !== "leetcode" && b.mode !== "acm") throw new SyncError("参数不对：mode");
  if (typeof b.code !== "string" || !b.code.trim() || b.code.length > 100_000) throw new SyncError("代码是空的，或者超过 100 KB");
  if (!RECORD_RESULTS.includes(b.result as Result)) throw new SyncError("参数不对：result");
  if (!int(b.passed, 10_000) || !int(b.total, 10_000) || (b.passed as number) > (b.total as number) || !b.total) throw new SyncError("参数不对：passed / total");
  if (typeof b.durationMs !== "number" || !Number.isFinite(b.durationMs) || b.durationMs < 0) throw new SyncError("参数不对：durationMs");
  if ((b.result === "通过") !== (b.passed === b.total)) throw new SyncError("结果和通过的用例数对不上");
  const failures = Array.isArray(b.failures) ? b.failures.slice(0, 3).map((f) => {
    const x = (f ?? {}) as Record<string, unknown>;
    return { label: short(x.label, 80), input: short(x.input), expected: short(x.expected), actual: short(x.actual), ...(x.error ? { error: short(x.error) } : {}) };
  }) : [];
  return { id: b.id as number, language: b.language as RecordLanguage, mode: b.mode, code: b.code, result: b.result as Result, passed: b.passed as number, total: b.total as number, durationMs: b.durationMs, failures };
}

/** 北京时间的日期和带时区的时间（尝试记录按北京时间记，和从力扣同步来的一致） */
export function beijing(now: Date) {
  const iso = new Date(now.getTime() + 8 * 3600_000).toISOString();
  return { date: iso.slice(0, 10), stamp: `${iso.slice(0, 19)}+08:00` };
}

/** 一次「测试全部」写成的尝试记录 */
export function renderSiteAttempt(input: RecordInput, stamp: string) {
  const code = input.code.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  const f = fence(code);
  const summary = [input.result, `用例 ${input.passed} / ${input.total}`, `用时 ${Math.round(input.durationMs)} ms`, input.mode === "acm" ? "ACM 模式" : "LeetCode 模式"].join(" · ");
  const fails = input.failures.flatMap((x) => [
    x.label,
    `输入：${x.input}`,
    `期望：${x.expected}`,
    x.error ? `出错：${x.error}` : `得到：${x.actual}`,
    "",
  ]);
  return [
    "---", `lang: ${input.language}`, "verbatim: true", `source: ${SITE_SOURCE}`, `submittedAt: ${stamp}`, "---",
    "", "## 代码", "", `${f}${input.language}`, code, f,
    "", "## 网站测试结果", "", summary,
    ...(fails.length ? ["", "## 没通过的用例", "", ...fails] : [""]),
  ].join("\n");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 写进进度仓（一个 commit）。仓库在这期间被别处改动过（比如网站上刚改了状态）就重新读一遍再写，最多试 3 次。
 * 返回这次 commit、尝试记录的路径、新存的题解路径（没存时是 null）和新的状态（没变时是 null）。
 */
export async function recordRun({ api, repo, input, now = new Date() }: { api: Api; repo: string; input: RecordInput; now?: Date }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const head = await readRepo(api, repo);
    const sha = new Map(head.files.map((f) => [f.path, f.sha]));
    if (!sha.has("hot100.json")) throw new SyncError("进度仓里没有 hot100.json：确认这个仓库是用模板建的", 409);

    // 题名用进度仓自己的 hot100.json，和仓库里已有的目录名保证一致
    const ext = RECORD_EXT[input.language];
    const pad4 = String(input.id).padStart(4, "0");
    const solutionFiles = head.files.filter((f) => f.path.startsWith(`solutions/${input.language}/${pad4}.`) && f.path.endsWith(`.${ext}`));
    const want = ["hot100.json", "progress.json"].filter((p) => sha.has(p)).map((p) => sha.get(p)!);
    const texts = await readBlobs(api, repo, [...new Set([...want, ...solutionFiles.slice(0, 40).map((f) => f.sha)])]);
    const hot = JSON.parse(texts[sha.get("hot100.json")!]) as { problems: { id: number; name: string; slug: string }[] };
    const problem = hot.problems.find((p) => p.id === input.id);
    if (!problem) throw new SyncError(`进度仓的题单里没有第 ${input.id} 题`, 404);

    const { date, stamp } = beijing(now);
    let seq = 0;
    for (const f of head.files) { const a = parseAttemptPath(f.path); if (a && a.id === problem.id && a.date === date) seq = Math.max(seq, a.seq); }
    const attemptFile = attemptPath(problem, date, seq + 1, input.result);
    const files = [{ path: attemptFile, content: renderSiteAttempt(input, stamp) }];

    // 全部通过：代码和已有的题解都不一样时另存一份，已有的题解一个都不动
    let solution: string | null = null;
    if (input.result === "通过") {
      const base = `solutions/${input.language}/${pad4}.${problem.name}`;
      const mine = solutionFiles.filter((f) => new RegExp(`^${escapeRe(base)}(\\.[^/.]+)?\\.${ext}$`).test(f.path));
      if (!mine.some((f) => texts[f.sha] != null && codeKey(texts[f.sha]) === codeKey(input.code))) {
        let path = `${base}.${ext}`;
        for (let n = 2; sha.has(path); n++) path = `${base}.${n}.${ext}`;
        solution = path;
        files.push({ path, content: input.code.replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n" });
      }
    }

    const progress: ProgressFile = sha.has("progress.json") ? JSON.parse(texts[sha.get("progress.json")!]) : { version: 1, problems: {} };
    const status = nextStatus(progress.problems?.[String(problem.id)], [{ result: input.result, date }]);
    if (status) files.push({ path: "progress.json", content: writeProgress(progress, new Map([[problem.id, status]])) });

    const message = [
      `练习：第 ${problem.id} 题「${problem.name}」${input.result}（${input.language}，用例 ${input.passed} / ${input.total}）`,
      "",
      `- 尝试记录：${attemptFile}`,
      ...(solution ? [`- 题解：${solution}`] : []),
      ...(status ? [`- 状态：${progress.problems?.[String(problem.id)]?.status || "未开始"} → ${status.status}`] : []),
      "",
      "由热题 100 网站的练习「测试全部」生成。",
    ].join("\n");
    const res = await commitWrites(api, repo, { branch: head.branch, parent: head.commit, baseTree: head.tree, files, message }, { solutions: true });
    if ("conflict" in res) continue;
    return { ...res, attempt: attemptFile, solution, status: status?.status ?? null };
  }
  throw new SyncError("进度仓一直在变，稍后再试", 409);
}
