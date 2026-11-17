// 「测试全部」跑完之后，按进度仓的规则判一个结果（通过 / 答案错误 / 超时 / 运行出错），并写几行没通过的用例说明。
// 只在浏览器里用；结果交给 functions/api/progress/practice.ts 记成尝试记录（服务端会再检查一遍）。
import type { Result } from "../sync/core.ts";
import { formatPracticeInput, formatPracticeResult } from "./format";
import type { PracticeCase, PracticeMode, PracticeProblem, PracticeRunResult } from "./types";

export interface PracticeVerdict { result: Result; passed: number; total: number; notes: string[] }

const clip = (s: string, n = 120) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** 用户停掉的、运行环境没加载出来的（不是代码的问题）不记，返回 null */
export function practiceVerdict(problem: PracticeProblem, mode: PracticeMode, cases: PracticeCase[], run: PracticeRunResult): PracticeVerdict | null {
  if (run.cancelled || !cases.length) return null;
  const errors = run.results.filter((r) => r.error);
  if (errors.some((r) => r.error!.startsWith("运行环境加载超时"))) return null;
  const total = cases.length;
  const passed = run.results.filter((r) => r.passed && !r.error).length;
  const result: Result = errors.some((r) => r.error!.startsWith("运行超时")) ? "超时" : errors.length ? "运行出错" : passed === total ? "通过" : "答案错误";
  const notes = run.results.filter((r) => r.error || !r.passed).slice(0, 3).map((r) => {
    const test = cases[r.index];
    const input = !test ? "" : mode === "acm" ? test.stdin : formatPracticeInput(problem, test);
    const what = r.error
      ? clip(r.error, 200)
      : mode === "acm"
        ? `预期输出 ${clip(test?.stdout ?? "")}，实际输出 ${clip(r.stdout || "（无输出）")}`
        : `预期 ${clip(formatPracticeResult(problem, r.expected))}，实际 ${clip(formatPracticeResult(problem, r.actual))}`;
    return `用例 ${r.index + 1}：${what}${input ? `（输入 ${clip(input)}）` : ""}`;
  });
  return { result, passed, total, notes };
}
