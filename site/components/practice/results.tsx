"use client";

import clsx from "clsx";
import { useState } from "react";

import type { PracticeCase, PracticeMode, PracticeProblem, PracticeRunResult } from "@/lib/practice/types";
import { formatPracticeInput, formatPracticeResult } from "@/lib/practice/format";

export function PracticeResults({ result, cases, mode, unchecked, stale, problem }: {
  problem: PracticeProblem;
  result: PracticeRunResult;
  cases: PracticeCase[];
  mode: PracticeMode;
  unchecked: boolean;
  stale: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, result.results.length - 1));
  const current = result.results[index];
  const test = current ? cases[current.index] : undefined;
  const passed = result.results.filter((r) => r.passed && !r.error).length;
  const failed = result.results.some((r) => r.error || (!unchecked && !r.passed));
  const complete = result.results.length === cases.length;
  const title = result.cancelled ? "已停止" : failed ? "有用例未通过" : unchecked ? "运行完成" : complete ? "全部通过" : "运行结束";

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className={clsx("size-2 rounded-[2px]", result.cancelled ? "bg-muted" : failed ? "bg-danger" : "bg-success")} />
          <span className={clsx("text-sm font-semibold", result.cancelled ? "text-muted" : failed ? "text-danger" : "text-success")}>{title}</span>
          {!unchecked && <span className="font-mono text-xs text-muted">{passed} / {cases.length}</span>}
          {unchecked && <span className="text-xs text-muted">未设置预期，仅运行</span>}
        </div>
        <span className="font-mono text-[11px] text-muted">{Math.round(result.duration)} ms</span>
      </div>
      {stale && <p className="text-xs text-warning">代码已修改，下方是上一次运行的结果。</p>}
      {!!result.results.length && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="选择测试结果">
          {result.results.map((r, i) => (
            <button
              aria-pressed={index === i}
              className={clsx("shrink-0 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent", index === i ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground")}
              key={r.index}
              onClick={() => setSelected(i)}
              type="button"
            >
              <span className={clsx("me-1.5", r.error || (!unchecked && !r.passed) ? "text-danger" : "text-success")}>{r.error || (!unchecked && !r.passed) ? "×" : "✓"}</span>
              用例 {r.index + 1}
            </button>
          ))}
        </div>
      )}
      {current && (
        <div className="flex flex-col gap-3 text-xs">
          {current.error && <pre className="practice-output whitespace-pre-wrap border-danger/30 bg-danger/5 text-danger">{current.error}</pre>}
          <ResultField label="输入" text={mode === "acm" ? test?.stdin || "（空输入）" : test ? formatPracticeInput(problem, test) : ""} />
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <ResultField label="实际结果" text={mode === "acm" ? current.stdout || "（无输出）" : formatPracticeResult(problem, current.actual)} />
            <ResultField label="预期结果" text={unchecked ? "未设置（仅运行）" : mode === "acm" ? test?.stdout || "（空输出）" : formatPracticeResult(problem, current.expected)} />
          </div>
          {mode === "leetcode" && current.stdout && <ResultField label="标准输出 / 调试信息" text={current.stdout} />}
        </div>
      )}
    </div>
  );
}

function ResultField({ label, text }: { label: string; text: string | undefined }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] text-muted">{label}</span>
      <pre className="practice-output">{text}</pre>
    </div>
  );
}
