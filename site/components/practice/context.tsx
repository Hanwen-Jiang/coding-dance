"use client";

import { Segment } from "@heroui-pro/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { withFigures } from "@/components/demo/figures";
import { PixelLoader } from "@/components/pixel";
import { usePrefs } from "@/lib/prefs";
import type { PracticeLanguage, PracticeMode, PracticeProblem } from "@/lib/practice/types";
import type { ProblemDetail } from "@/lib/types";

const OPTIONS_KEY = "hot100:practice:options";
const isLanguage = (value: unknown): value is PracticeLanguage => ["python", "javascript", "typescript"].includes(String(value));
type PracticeContextValue = {
  detail: ProblemDetail;
  problem: PracticeProblem | null;
  error: string | null;
  retry: () => void;
  mode: PracticeMode;
  language: PracticeLanguage;
  select: (mode: PracticeMode, language: PracticeLanguage) => void;
};
const PracticeContext = createContext<PracticeContextValue | null>(null);

export function PracticeProvider({ detail, children }: { detail: ProblemDetail; children: React.ReactNode }) {
  const [problem, setProblem] = useState<PracticeProblem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<PracticeMode>("leetcode");
  const [language, setLanguage] = useState<PracticeLanguage>("python");
  const { langs } = usePrefs();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || "null") as { mode?: unknown; language?: unknown } | null;
      if (saved?.mode === "leetcode" || saved?.mode === "acm") setMode(saved.mode);
      setLanguage(isLanguage(saved?.language) ? saved.language : langs.find(isLanguage) || "python");
    } catch { /* 使用默认选项。 */ }
  }, [langs]);

  useEffect(() => {
    const controller = new AbortController();
    setProblem(null);
    setError(null);
    fetch(`/practice/${String(detail.summary.id).padStart(4, "0")}.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`练习数据暂时无法加载（${response.status}）`);
        return response.json() as Promise<PracticeProblem>;
      })
      .then((data) => {
        if (data.id !== detail.summary.id || !data.cases?.length || !data.starters) throw new Error("这道题的练习数据不完整，请稍后重试。");
        if (!controller.signal.aborted) setProblem(data);
      })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [detail.summary.id, revision]);

  const select = (nextMode: PracticeMode, nextLanguage: PracticeLanguage) => {
    setMode(nextMode);
    setLanguage(nextLanguage);
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify({ mode: nextMode, language: nextLanguage })); } catch { /* 本次选择仍然有效。 */ }
  };
  return <PracticeContext.Provider value={{ detail, problem, error, retry: () => setRevision((value) => value + 1), mode, language, select }}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const value = useContext(PracticeContext);
  if (!value) throw new Error("练习组件需要 PracticeProvider");
  return value;
}

export function PracticeModeSwitch() {
  const { mode, language, select } = usePractice();
  return (
    <Segment aria-label="编程模式" onSelectionChange={(key) => select(String(key) as PracticeMode, language)} selectedKey={mode} size="sm">
      <Segment.Item id="leetcode">LeetCode</Segment.Item>
      <Segment.Item id="acm">ACM</Segment.Item>
    </Segment>
  );
}

/** 原题面保留在原页面的 SectionTitle / Card 位置，只在切换 ACM 时替换内容。 */
export function PracticeStatement() {
  const { detail, mode, problem, error } = usePractice();
  if (mode === "leetcode") return detail.statementHtml ? <div className="statement" dangerouslySetInnerHTML={{ __html: withFigures(detail.statementHtml, detail.spec?.figures) }} /> : <p className="text-muted">仓库里还没有这道题的题面。</p>;
  if (!problem) return error ? <p className="text-sm text-danger">{error}</p> : <PixelLoader label="PROBLEM" />;
  return (
    <div className="flex flex-col gap-6 text-[15px] leading-7">
      <div><p className="mb-2 font-pixel text-[10px] tracking-wider text-accent">ACM · STDIN / STDOUT</p><p className="whitespace-pre-line">{problem.acm.description}</p></div>
      <div><h3 className="mb-2 font-semibold">输入格式</h3><p className="whitespace-pre-line text-muted">{problem.acm.input}</p></div>
      <div><h3 className="mb-2 font-semibold">输出格式</h3><p className="whitespace-pre-line text-muted">{problem.acm.output}</p></div>
      {problem.acm.examples.map((example, index) => (
        <div className="flex flex-col gap-2" key={index}>
          <h3 className="font-semibold">样例 {index + 1}</h3>
          <span className="text-xs text-muted">输入</span><pre className="practice-output practice-statement-example">{example.input || "（空输入）"}</pre>
          <span className="text-xs text-muted">输出</span><pre className="practice-output practice-statement-example">{example.output || "（空输出）"}</pre>
          {example.explanation && <p className="text-xs leading-6 text-muted">{example.explanation}</p>}
        </div>
      ))}
      {!!problem.acm.notes.length && <div><h3 className="mb-2 font-semibold">说明</h3><ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-muted">{problem.acm.notes.map((note) => <li key={note}>{note}</li>)}</ul></div>}
    </div>
  );
}
