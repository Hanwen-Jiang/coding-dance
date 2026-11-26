"use client";

import { Button, Chip } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { withFigures } from "@/components/demo/figures";
import { CodeIcon } from "@/components/icons";
import { PixelLoader } from "@/components/pixel";
import { ModeIntroModal, shouldShowModeIntro } from "@/components/practice/mode-intro";
import { setPracticeDocked } from "@/lib/practice/dock";
import { usePrefs } from "@/lib/prefs";
import { PRACTICE_LANGUAGES, type PracticeLanguage, type PracticeMode, type PracticeProblem } from "@/lib/practice/types";
import type { ProblemDetail } from "@/lib/types";

const OPTIONS_KEY = "hot100:practice:options";
export const LOAD_EXAMPLE_EVENT = "hot100:practice:load-example";
export const APPLY_CODE_EVENT = "hot100:practice:apply-code";
export const OPEN_COMPANION_EVENT = "hot100:practice:open-companion";

const isLanguage = (value: unknown): value is PracticeLanguage => (PRACTICE_LANGUAGES as string[]).includes(String(value));
type PracticeContextValue = {
  detail: ProblemDetail;
  problem: PracticeProblem | null;
  error: string | null;
  retry: () => void;
  mode: PracticeMode;
  language: PracticeLanguage;
  select: (mode: PracticeMode, language: PracticeLanguage) => void;
  openModeIntro: () => void;
  loadExample: (index: number) => void;
  applySolutionCode: (code: string, lang: PracticeLanguage, targetMode: PracticeMode) => void;
  openCompanion: (intent?: "hint" | "debug" | "review" | "acm_io") => void;
};
const PracticeContext = createContext<PracticeContextValue | null>(null);

/**
 * 读过的练习数据留在内存里（同一个地址同时只发一个请求）。题目页会提前读好上一题、下一题的，
 * 换题时编辑器直接出来，不用再等一轮「正在准备练习」。失败的不留，重试会重新读。
 */
const practiceCache = new Map<number, PracticeProblem>();
const practicePending = new Map<number, Promise<PracticeProblem>>();
function loadPractice(id: number): Promise<PracticeProblem> {
  const hit = practiceCache.get(id);
  if (hit) return Promise.resolve(hit);
  let pending = practicePending.get(id);
  if (!pending) {
    pending = fetch(`/api/practice/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`练习数据暂时无法加载（${response.status}）`);
        const data = (await response.json()) as PracticeProblem;
        if (data.id !== id || !data.cases?.length || !data.starters) throw new Error("这道题的练习数据不完整，请稍后重试。");
        practiceCache.set(id, data);
        return data;
      })
      .finally(() => practicePending.delete(id));
    practicePending.set(id, pending);
  }
  return pending;
}
export function prefetchPractice(id: number) {
  loadPractice(id).catch(() => { /* 真用到时再报错 */ });
}

function savedOptions(): { mode?: PracticeMode; language?: PracticeLanguage } {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || "null") as { mode?: unknown; language?: unknown } | null;
    return { mode: saved?.mode === "leetcode" || saved?.mode === "acm" ? saved.mode : undefined, language: isLanguage(saved?.language) ? saved.language : undefined };
  } catch { return {}; }
}

export function PracticeProvider({ detail, children }: { detail: ProblemDetail; children: React.ReactNode }) {
  const [problem, setProblem] = useState<PracticeProblem | null>(() => practiceCache.get(detail.summary.id) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  // 存过的模式、语言一开始就用上（数据已经在内存里时编辑器第一次渲染就是对的，不会先按默认值建一个再换掉）
  const [initial] = useState(savedOptions);
  const [mode, setMode] = useState<PracticeMode>(initial.mode ?? "leetcode");
  const [language, setLanguage] = useState<PracticeLanguage>(initial.language ?? "python");
  const [introOpen, setIntroOpen] = useState(false);
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
    if (shouldShowModeIntro()) {
      const t = window.setTimeout(() => setIntroOpen(true), 420);
      return () => window.clearTimeout(t);
    }
  }, [langs]);

  useEffect(() => {
    let alive = true;
    const id = detail.summary.id;
    setError(null);
    const hit = practiceCache.get(id);
    if (hit) { setProblem(hit); return; }
    setProblem(null);
    loadPractice(id)
      .then((data) => { if (alive) setProblem(data); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [detail.summary.id, revision]);

  const select = useCallback((nextMode: PracticeMode, nextLanguage: PracticeLanguage) => {
    setMode(nextMode);
    setLanguage(nextLanguage);
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify({ mode: nextMode, language: nextLanguage })); } catch { /* 本次选择仍然有效。 */ }
  }, []);

  const loadExample = useCallback((index: number) => {
    setPracticeDocked(true);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(LOAD_EXAMPLE_EVENT, { detail: { index } }));
    }, 30);
  }, []);

  const applySolutionCode = useCallback((code: string, targetLang: PracticeLanguage, targetMode: PracticeMode) => {
    try {
      localStorage.setItem(`hot100:practice:draft:${detail.summary.id}:${targetMode}:${targetLang}`, code);
    } catch { /* ignore */ }
    select(targetMode, targetLang);
    setPracticeDocked(true);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(APPLY_CODE_EVENT, { detail: { code, language: targetLang, mode: targetMode } }));
    }, 40);
  }, [detail.summary.id, select]);

  const openCompanion = useCallback((intent?: "hint" | "debug" | "review" | "acm_io") => {
    setPracticeDocked(true);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMPANION_EVENT, { detail: { intent } }));
    }, 40);
  }, []);

  return (
    <PracticeContext.Provider
      value={{
        detail,
        problem,
        error,
        retry: () => setRevision((value) => value + 1),
        mode,
        language,
        select,
        openModeIntro: () => setIntroOpen(true),
        loadExample,
        applySolutionCode,
        openCompanion,
      }}
    >
      {children}
      <ModeIntroModal
        currentMode={mode}
        onOpenChange={setIntroOpen}
        onPickMode={(picked, openWorkbench) => {
          select(picked, language);
          setIntroOpen(false);
          if (openWorkbench && window.matchMedia("(min-width: 1200px)").matches) {
            setPracticeDocked(true);
          }
        }}
        open={introOpen}
      />
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const value = useContext(PracticeContext);
  if (!value) throw new Error("练习组件需要 PracticeProvider");
  return value;
}

export function PracticeModeSwitch({ showGuide = false }: { showGuide?: boolean }) {
  const { mode, language, select, openModeIntro } = usePractice();
  return (
    <div className="inline-flex items-center gap-1">
      <Segment aria-label="编程模式" onSelectionChange={(key) => select(String(key) as PracticeMode, language)} selectedKey={mode} size="sm">
        <Segment.Item id="leetcode">LeetCode</Segment.Item>
        <Segment.Item id="acm">ACM</Segment.Item>
      </Segment>
      {showGuide && (
        <button
          aria-label="对比 LeetCode 与 ACM 两种模式"
          className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-surface text-[11px] font-semibold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          onClick={openModeIntro}
          title="对比 LeetCode 与 ACM 两种练习模式"
          type="button"
        >
          ?
        </button>
      )}
    </div>
  );
}

function CopyTextButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };
  return (
    <button
      className="rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      onClick={copy}
      type="button"
    >
      {copied ? "已复制" : label}
    </button>
  );
}

/** 将题面 `1. nums：描述` 格式拆成结构化参数行，设计类则拆成操作列表。 */
function FormatSpec({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const lead = lines[0]?.startsWith("依次读取") ? lines[0] : null;
  const rows = (lead ? lines.slice(1) : lines).map((line) => {
    const paramMatch = line.match(/^(\d+)\.\s*([^：:]+)[：:]\s*(.+)$/);
    if (paramMatch) return { kind: "param" as const, index: paramMatch[1], name: paramMatch[2], desc: paramMatch[3] };
    return { kind: "text" as const, text: line };
  });
  return (
    <div className="flex flex-col gap-2 text-xs leading-6 text-muted">
      {lead && <p className="m-0 text-foreground/85">{lead}</p>}
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) =>
          r.kind === "param" ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-surface px-2.5 py-1.5" key={i}>
              <span className="font-mono text-[11px] text-muted">{r.index}.</span>
              <code className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent">{r.name}</code>
              <span className="min-w-0 flex-1 text-foreground/90">{r.desc}</span>
            </div>
          ) : (
            <p className="m-0 text-foreground/85" key={i}>{r.text}</p>
          ),
        )}
      </div>
    </div>
  );
}

/** 原题面保留在原页面的 SectionTitle / Card 位置，切换 ACM 时渲染精心编排的 OJ 风格标准 I/O 题面。 */
export function PracticeStatement() {
  const { detail, mode, problem, error, language, select, openModeIntro, loadExample } = usePractice();
  if (mode === "leetcode") {
    return detail.statementHtml
      ? <div className="statement" dangerouslySetInnerHTML={{ __html: withFigures(detail.statementHtml, detail.spec?.figures) }} />
      : <p className="text-muted">仓库里还没有这道题的题面。</p>;
  }
  if (!problem) return error ? <p className="text-sm text-danger">{error}</p> : <PixelLoader label="PROBLEM" />;

  const constraints = problem.acm.notes.filter((n) => n.startsWith("数据范围：")).map((n) => n.slice("数据范围：".length));
  const conventions = problem.acm.notes.filter((n) => !n.startsWith("数据范围："));

  return (
    <div className="flex flex-col gap-6 text-[15px] leading-7" data-testid="acm-statement">
      {/* 顶部模式徽章 + 对比 / 切换入口 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="warning" size="sm" variant="soft">
            <span className="font-pixel text-[10px] tracking-wider">ACM · STDIN / STDOUT</span>
          </Chip>
          <span className="rounded-md bg-foreground/[0.04] px-2 py-0.5 font-mono text-[11px] text-muted">
            单组输入
          </span>
          <span className="rounded-md bg-foreground/[0.04] px-2 py-0.5 font-mono text-[11px] text-muted">
            无额外提示输出
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
            onClick={openModeIntro}
            type="button"
          >
            模式对比
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
            onClick={() => select("leetcode", language)}
            type="button"
          >
            切回 LeetCode
          </button>
        </div>
      </div>

      {/* 题目描述正文 */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">题目描述</h3>
        <p className="whitespace-pre-line text-[15px] leading-7 text-foreground">{problem.acm.description}</p>
      </div>

      {/* 结构化输入 / 输出格式双卡片 */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-foreground/[0.02] p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="size-1.5 rounded-[2px] bg-accent" />
              输入格式
            </h3>
            <span className="font-mono text-[10px] tracking-wider text-muted">STDIN</span>
          </div>
          <FormatSpec text={problem.acm.input} />
        </div>
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-foreground/[0.02] p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="size-1.5 rounded-[2px] bg-success" />
              输出格式
            </h3>
            <span className="font-mono text-[10px] tracking-wider text-muted">STDOUT</span>
          </div>
          <FormatSpec text={problem.acm.output} />
        </div>
      </div>

      {/* 样例双栏对比卡片 */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">输入输出样例</h3>
        <div className="flex flex-col gap-3">
          {problem.acm.examples.map((example, index) => (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-foreground/[0.015] p-4" key={index}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                    样例 {index + 1}
                  </span>
                </div>
                <Button
                  className="h-6 min-h-6 px-2 text-xs"
                  onPress={() => loadExample(index)}
                  size="sm"
                  variant="ghost"
                >
                  <CodeIcon height={12} width={12} />
                  载入自定义测试
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted">标准输入</span>
                    <CopyTextButton text={example.input} />
                  </div>
                  <pre className="practice-output practice-statement-example m-0">{example.input || "（空输入）"}</pre>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted">标准输出</span>
                    <CopyTextButton text={example.output} />
                  </div>
                  <pre className="practice-output practice-statement-example m-0">{example.output || "（空输出）"}</pre>
                </div>
              </div>
              {example.explanation && (
                <p className="m-0 border-t border-separator pt-2 text-xs leading-5 text-muted">
                  {example.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 数据范围与判题约定 */}
      {(constraints.length > 0 || conventions.length > 0) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-foreground/[0.015] p-4">
          {constraints.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">数据范围</h3>
              <div className="flex flex-wrap gap-1.5">
                {constraints.map((c) => (
                  <code className="rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-xs text-foreground" key={c}>
                    {c}
                  </code>
                ))}
              </div>
            </div>
          )}
          {conventions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">判题约定</h3>
              <ul className="m-0 list-disc space-y-1 pl-5 text-xs leading-6 text-muted">
                {conventions.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
