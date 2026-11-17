"use client";

import { Button, Card, ListBox, Modal, Select, Switch, TextArea } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { ChevronDown, CodeIcon, DocIcon, PlayIcon } from "@/components/icons";
import { PixelLoader, Skel } from "@/components/pixel";
import { PracticeModeSwitch, PracticeStatement, usePractice } from "@/components/practice/context";
import { PracticeResults } from "@/components/practice/results";
import { ResizeHandle, useMedia, useStoredFraction } from "@/components/practice/resize";
import { decodeAcmInput, encodeAcmInput, encodeAcmOutput, parseAcmOutput } from "@/lib/practice/acm";
import { runPractice } from "@/lib/practice/runner";
import type { PracticeCase, PracticeHints, PracticeLanguage, PracticeMode, PracticeProblem, PracticeRunResult } from "@/lib/practice/types";
import { formatPracticeInput, formatPracticeResult, formatPracticeValue, parsePracticeFields, practiceInputFields, starterHash, type PracticeInputField } from "@/lib/practice/format";
import { useProgress } from "@/lib/progress";

import "./practice.css";

const CodeEditor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: () => <div className="practice-editor-loading flex items-center justify-center"><PixelLoader label="EDITOR" /></div>,
});
const LANGUAGES: { id: PracticeLanguage; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
];
type TestTab = "examples" | "custom" | "results";
/** 编辑器提示程度，存在浏览器里，换题、换语言都不变 */
const HINT_LEVELS: { id: PracticeHints; label: string; desc: string }[] = [
  { id: "full", label: "完整提示", desc: "提示关键字、内置函数、库函数和类型" },
  { id: "none", label: "无提示", desc: "只补全代码里已有的变量和函数" },
];
const HINTS_KEY = "hot100:practice:hints";
function readHints(): PracticeHints {
  try { const v = localStorage.getItem(HINTS_KEY); if (v === "full" || v === "none") return v; } catch { /* 存储不可用 */ }
  return "full";
}
/** 「测试全部」的结果要不要记进进度仓，存在浏览器里，默认记 */
const RECORD_KEY = "hot100:practice:record";
function readRecord() {
  try { return localStorage.getItem(RECORD_KEY) !== "off"; } catch { return true; }
}
/** 题解页上的「我的题解」「尝试记录」听这个事件重新读进度仓 */
export const RECORDS_CHANGED = "hot100:records-changed";
type RecordState =
  | { state: "saving" }
  | { state: "saved"; url: string; attempt: string; solution: string | null; status: string | null }
  | { state: "error"; message: string };

/** 一次「测试全部」的结果，按进度仓的规则分类；停止运行的不记 */
function classifyRun(result: PracticeRunResult, cases: PracticeCase[]) {
  if (result.cancelled || result.results.length < cases.length) return null;
  const failed = result.results.filter((r) => !r.passed).sort((a, b) => a.index - b.index);
  const outcome = !failed.length ? "通过" : failed.some((r) => r.error?.includes("运行超时")) ? "超时" : failed.some((r) => r.error) ? "运行出错" : "答案错误";
  return { outcome, failed, passed: result.results.length - failed.length };
}

/**
 * 专注模式里题面的三种状态：split 题面和代码都在；folded 题面收起，只留标题栏（并排时收成一条窄边）；
 * only 只看题面（上下排列时代码区只留顶上那一行工具条）。
 */
type StatementView = "split" | "folded" | "only";

export function PracticeWorkbench() {
  const { detail, problem, error, retry, mode, language, select } = usePractice();
  const [focusPhase, setFocusPhase] = useState<"closed" | "open" | "closing">("closed");
  const [statementView, setStatementView] = useState<StatementView>("split");
  const active = focusPhase !== "closed";
  const reducedMotion = useReducedMotion();
  const focusButton = useRef<HTMLButtonElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const shell = useRef<HTMLElement>(null);
  const statementBodyId = useId();
  // 题面占多大：并排（≥1024）时是宽度，上下排列时是高度；两种各记各的
  const wide = useMedia("(min-width: 1024px)");
  const [splitX, setSplitX, commitX] = useStoredFraction("hot100:practice:split-x", 0.47, 0.22, 0.75);
  const [splitY, setSplitY, commitY] = useStoredFraction("hot100:practice:split-y", 0.38, 0.15, 0.8);
  const openFocus = useCallback(() => { setStatementView("split"); setFocusPhase("open"); }, []);
  const closeFocus = useCallback(() => setFocusPhase((phase) => phase === "open" ? "closing" : phase), []);
  const finishClosing = useCallback(() => setFocusPhase((phase) => phase === "closing" ? "closed" : phase), []);

  useEffect(() => {
    if (!active) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = [document.querySelector(".problem-original"), document.querySelector("body > header"), document.querySelector("body > footer")].filter((node): node is HTMLElement => node instanceof HTMLElement);
    const previous = background.map((node) => node.inert);
    background.forEach((node) => { node.inert = true; });
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) closeFocus(); };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = overflow;
      background.forEach((node, index) => { node.inert = previous[index]; });
      window.removeEventListener("keydown", onEscape);
      // 窄屏上页面里的编辑器是收起来的，焦点回到底部的「写代码」按钮
      (focusButton.current?.offsetParent ? focusButton.current : launcher.current)?.focus({ preventScroll: true });
    };
  }, [active, closeFocus]);

  useLayoutEffect(() => {
    if (!active) return;
    const original = document.querySelector<HTMLElement>(".problem-original");
    if (!original) return;
    const visibility = original.style.visibility;
    original.style.visibility = "hidden";
    return () => { original.style.visibility = visibility; };
  }, [active]);

  useEffect(() => {
    if (focusPhase !== "closing") return;
    const timeout = setTimeout(finishClosing, reducedMotion ? 0 : 120);
    return () => clearTimeout(timeout);
  }, [focusPhase, reducedMotion, finishClosing]);

  const folded = statementView === "folded";
  return (
    <>
    <aside
      aria-label={active ? "代码专注模式" : "代码练习"}
      aria-modal={active ? true : undefined}
      className={clsx("practice-sidebar practice-shell", active && "practice-shell--focus", focusPhase === "closing" && "practice-shell--closing")}
      data-focus-phase={focusPhase}
      data-statement={statementView}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget && focusPhase === "closing") flushSync(finishClosing); }}
      ref={shell}
      role={active ? "dialog" : undefined}
      style={active ? ({ "--practice-statement-size": `${(wide ? splitX : splitY) * 100}%` } as React.CSSProperties) : undefined}
    >
      <section aria-label="专注题面" className="practice-focus-statement" hidden={!active} key="statement">
        <div className="practice-focus-statement-heading">
          <span className="practice-statement-id font-mono text-xs text-muted">{detail.summary.id}.</span>
          <h2 className="practice-statement-title min-w-0 flex-1 truncate text-base font-bold">{detail.summary.name}</h2>
          <div className="practice-statement-actions flex shrink-0 items-center gap-1">
            {statementView === "only" ? (
              <Button onPress={() => setStatementView("split")} size="sm" variant="ghost"><CodeIcon />返回代码</Button>
            ) : (
              <>
                {/* 只看题目：上下排列（窄屏）时才有，并排时用不着 */}
                {!folded && <Button className="practice-only-toggle" onPress={() => setStatementView("only")} size="sm" variant="ghost"><DocIcon />只看题目</Button>}
                <Button aria-controls={statementBodyId} aria-expanded={!folded} aria-label={folded ? "展开题目" : "收起题目"} className="practice-fold-toggle" onPress={() => setStatementView(folded ? "split" : "folded")} size="sm" variant="ghost">
                  <ChevronDown className={clsx("practice-fold-icon transition-transform", folded && "-rotate-90")} />
                  <span className="practice-fold-label">{folded ? "展开题目" : "收起"}</span>
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="practice-focus-statement-body" hidden={folded} id={statementBodyId}><PracticeStatement /></div>
      </section>
      <ResizeHandle
        axis={wide ? "x" : "y"}
        className="practice-split-handle"
        container={() => shell.current}
        fallback={wide ? 0.47 : 0.38}
        hidden={!active || statementView !== "split"}
        label={wide ? "调整题面宽度" : "调整题面高度"}
        max={wide ? 0.75 : 0.8}
        min={wide ? 0.22 : 0.15}
        onChange={wide ? setSplitX : setSplitY}
        onCommit={wide ? commitX : commitY}
        value={wide ? splitX : splitY}
      />
      <div className="practice-editor-column" key="editor">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
          <PracticeModeSwitch />
          <Button aria-label={active ? "退出专注模式" : "进入专注模式"} isDisabled={focusPhase === "closing"} onPress={() => { if (active) closeFocus(); else openFocus(); }} ref={focusButton} size="sm" variant="ghost"><ExpandIcon collapsed={active} />{active ? "退出专注" : "专注模式"}</Button>
        </div>
        {problem ? <PracticeSession key={`${problem.id}:${mode}:${language}`} language={language} mode={mode} onLanguageChange={(value) => select(mode, value)} problem={problem} /> : (
          <Card className="min-w-0 items-center justify-center gap-4 px-6 py-14">
            {error ? <><p className="text-sm text-danger" role="alert">{error}</p><Button onPress={retry} size="sm" variant="outline">重新加载练习</Button></> : <><CodeIcon height={24} width={24} /><p className="text-sm text-muted">正在准备练习…</p><Skel className="h-56 w-full rounded-2xl" /></>}
          </Card>
        )}
      </div>
    </aside>
    {/* 1200px 以下页面里不放编辑器：屏幕底部常驻「写代码」，点开是全屏的题面 + 编辑器（显示规则见 practice.css） */}
    <div className="practice-launcher" hidden={active}>
      <Button aria-label="写代码" className="practice-launcher-button" onPress={openFocus} ref={launcher}>
        <CodeIcon />
        <span className="font-semibold">写代码</span>
        <span className="practice-launcher-meta">{LANGUAGES.find((entry) => entry.id === language)?.label} · {mode === "acm" ? "ACM" : "LeetCode"}</span>
      </Button>
    </div>
    </>
  );
}

function PracticeSession({ problem, mode, language, onLanguageChange }: {
  problem: PracticeProblem;
  mode: PracticeMode;
  language: PracticeLanguage;
  onLanguageChange: (language: PracticeLanguage) => void;
}) {
  const starter = problem.starters[mode][language];
  const samples = problem.examples?.length ? problem.examples : problem.cases.slice(0, 1);
  const draftKey = `hot100:practice:draft:${problem.id}:${mode}:${language}`;
  const [code, setCode] = useState(starter);
  const [ready, setReady] = useState(false);
  const [hints, setHints] = useState<PracticeHints>(readHints);
  const changeHints = (value: PracticeHints) => { setHints(value); try { localStorage.setItem(HINTS_KEY, value); } catch { /* 这次仍然生效 */ } };
  const [confirmReset, setConfirmReset] = useState(false);
  const resetDescriptionId = useId();
  const [tab, setTab] = useState<TestTab>("results");
  const [panelOpen, setPanelOpen] = useState(false);
  // 控制台（示例 / 自定义 / 运行结果）占卡片多高，拖动条可以调
  const [consoleSize, setConsoleSize, commitConsole] = useStoredFraction("hot100:practice:console", 0.4, 0.15, 0.75);
  const [sample, setSample] = useState(0);
  const [customInput, setCustomInput] = useState(samples[0].stdin);
  const [customFields, setCustomFields] = useState<PracticeInputField[]>(() => practiceInputFields(problem, samples[0].input));
  const [customExpected, setCustomExpected] = useState(mode === "leetcode" ? formatPracticeValue(samples[0].expected) : samples[0].stdout);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ result: PracticeRunResult; cases: PracticeCase[]; code: string; unchecked: boolean } | null>(null);
  // 登录并开通了进度仓时，「测试全部」跑完把结果记进去（尝试记录；全部通过另存题解）
  const { ready: canRecord, session, refresh } = useProgress();
  const [recordOn, setRecordOn] = useState(readRecord);
  const changeRecord = (on: boolean) => { setRecordOn(on); try { localStorage.setItem(RECORD_KEY, on ? "on" : "off"); } catch { /* 这次仍然生效 */ } };
  const [record, setRecord] = useState<RecordState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const codeRef = useRef(code);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      let restored = saved;
      const hash = saved === null ? "" : starterHash(saved);
      const defaults = [problem.legacyAcmStarterHashes?.[language], ...(problem.previousAcmStarterHashes?.[language] ?? [])];
      if (saved !== null && mode === "acm" && defaults.includes(hash)) {
        const backupKey = `${draftKey}:before-template-migration:${hash}`;
        if (localStorage.getItem(backupKey) === null) localStorage.setItem(backupKey, saved);
        if (localStorage.getItem(backupKey) === saved) {
          localStorage.setItem(draftKey, starter);
          restored = starter;
        }
      }
      // 力扣模式换成了和力扣一样的模板：没改过的旧模板草稿直接换成新的
      if (saved !== null && mode === "leetcode" && (problem.previousLeetcodeStarterHashes?.[language] ?? []).includes(hash)) {
        localStorage.setItem(draftKey, starter);
        restored = starter;
      }
      if (restored !== null) { setCode(restored); codeRef.current = restored; }
    } catch { /* 存储不可用时继续使用当前编辑器。 */ }
    setReady(true);
    return () => {
      sequenceRef.current++;
      abortRef.current?.abort();
    };
  }, [draftKey]);

  const changeCode = (value: string) => {
    setCode(value);
    codeRef.current = value;
    setConfirmReset(false);
    try { localStorage.setItem(draftKey, value); } catch { /* 保留当前编辑内容。 */ }
  };

  /** 把一次「测试全部」写进进度仓。网页只交代码和结果，文件名和内容由服务端按进度仓的规则生成 */
  const saveRun = useCallback(async (result: PracticeRunResult, cases: PracticeCase[], snapshot: string, token: number) => {
    const run = classifyRun(result, cases);
    if (!run) return;
    const show = (value: string) => value.length > 300 ? `${value.slice(0, 300)}…` : value;
    const failures = run.failed.slice(0, 3).map((r) => {
      const test = cases[r.index];
      return {
        label: test?.label || `用例 ${r.index + 1}`,
        input: mode === "acm" ? test?.stdin ?? "" : test ? formatPracticeInput(problem, test) : "",
        expected: mode === "acm" ? test?.stdout ?? "" : formatPracticeResult(problem, r.expected),
        actual: mode === "acm" ? r.stdout : formatPracticeResult(problem, r.actual),
        ...(r.error ? { error: show(r.error) } : {}),
      };
    });
    setRecord({ state: "saving" });
    try {
      const response = await fetch("/api/practice/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: problem.id, language, mode, code: snapshot, result: run.outcome, passed: run.passed, total: cases.length, durationMs: Math.round(result.duration), failures }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
      if (sequenceRef.current !== token) return;
      setRecord({ state: "saved", url: data.url, attempt: data.attempt, solution: data.solution, status: data.status });
      window.dispatchEvent(new CustomEvent(RECORDS_CHANGED, { detail: { id: problem.id } }));
      if (data.status) void refresh(); // 状态变了：顶上的状态和题单跟着更新
    } catch (e) {
      if (sequenceRef.current === token) setRecord({ state: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [language, mode, problem, refresh]);

  const execute = useCallback(async (cases: PracticeCase[], unchecked = false, keep = false) => {
    if (!ready || running || abortRef.current || !cases.length) return;
    setRecord(null);
    // 模板原样没动（和力扣一样方法体是空的）：不跑，直接提示
    if (codeRef.current.trim() === starter.trim()) {
      setReport(null);
      setPanelOpen(true);
      setTab("results");
      setError(mode === "acm" ? "还没写程序：先写好读入、计算和输出，再运行。" : "还没写解法：在模板的方法里补上代码，再运行。");
      return;
    }
    const token = ++sequenceRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const snapshot = codeRef.current;
    setError(null);
    setReport(null);
    setStatus(language === "python" ? "正在准备 Python 运行环境，首次运行请稍候…" : "正在运行测试…");
    setPanelOpen(true);
    setRunning(true);
    setTab("results");
    try {
      const result = await runPractice({ problem, language, mode, code: snapshot, cases }, {
        signal: controller.signal,
        onStatus: (value) => { if (sequenceRef.current === token) setStatus(value); },
      });
      if (sequenceRef.current === token) {
        setReport({ result, cases, code: snapshot, unchecked });
        if (keep && canRecord && recordOn) void saveRun(result, cases, snapshot, token);
      }
    } catch (e) {
      if (sequenceRef.current === token) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (sequenceRef.current === token) { setRunning(false); abortRef.current = null; }
    }
  }, [canRecord, language, mode, problem, ready, recordOn, running, saveRun, starter]);

  const runCustom = () => {
    try {
      const input: unknown = mode === "leetcode" ? parsePracticeFields(problem, customFields) : decodeAcmInput(customInput, problem.signature);
      if (!Array.isArray(input)) throw new Error("请检查输入参数。");
      if (!problem.signature.cls && input.length !== problem.signature.params?.length) throw new Error(`这道题需要 ${problem.signature.params?.length || 0} 个参数，请将它们放在同一个数组中。`);
      if (problem.signature.cls && (input.length !== 2 || !Array.isArray(input[0]) || !Array.isArray(input[1]))) throw new Error("设计类题的输入是 [操作名数组, 参数数组]。");
      const unchecked = !customExpected.trim();
      const expected: unknown = unchecked ? undefined : mode === "leetcode" ? JSON.parse(customExpected) : parseAcmOutput(customExpected, problem.signature);
      const test: PracticeCase = {
        input,
        expected,
        stdin: mode === "acm" ? customInput : encodeAcmInput(input, problem.signature),
        stdout: unchecked ? "" : mode === "acm" ? customExpected : encodeAcmOutput(expected, problem.signature),
        label: "自定义用例",
      };
      void execute([test], unchecked);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const selectedSample = samples[Math.min(sample, samples.length - 1)];

  return (
    <Card className="min-w-0 gap-0 overflow-hidden p-0" id="practice" style={{ "--practice-console-size": `${consoleSize * 100}%` } as React.CSSProperties} onKeyDownCapture={(event) => {
      if (confirmReset) return;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat && !running) { if (tab === "custom") runCustom(); else void execute(samples); }
      }
    }}>
      <div className="practice-editor-toolbar flex flex-wrap items-center justify-between gap-2 border-b border-separator px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><CodeIcon /><span>动手练习</span></div>
        <div className="flex items-center gap-1.5">
          <Select aria-label="练习语言" className="w-36" isDisabled={running} onChange={(value) => { if (typeof value === "string") onLanguageChange(value as PracticeLanguage); }} value={language} variant="secondary">
            <Select.Trigger aria-label="练习语言" className="h-8 min-h-8 text-xs"><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover className="min-w-36" style={{ zIndex: 120 }}><ListBox aria-label="可选练习语言">{LANGUAGES.map((entry) => <ListBox.Item id={entry.id} key={entry.id} textValue={entry.label}>{entry.label}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
          </Select>
          <Select aria-label="编辑器提示" className="w-28" onChange={(value) => { if (typeof value === "string") changeHints(value as PracticeHints); }} value={hints} variant="secondary">
            {/* 框里只显示档位名，说明文字只在展开的选项里 */}
            <Select.Trigger aria-label="编辑器提示" className="h-8 min-h-8 text-xs"><Select.Value>{({ selectedText }) => selectedText}</Select.Value><Select.Indicator /></Select.Trigger>
            <Select.Popover className="min-w-52" style={{ zIndex: 120 }}>
              <ListBox aria-label="编辑器提示程度">
                {HINT_LEVELS.map((entry) => (
                  <ListBox.Item id={entry.id} key={entry.id} textValue={entry.label}>
                    <span className="flex flex-col"><span>{entry.label}</span><span className="text-[11px] text-muted">{entry.desc}</span></span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Modal isOpen={confirmReset} onOpenChange={setConfirmReset}>
            <Button aria-label="重置代码" isDisabled={running || !ready} isIconOnly size="sm" variant="ghost"><ResetIcon /></Button>
            <Modal.Backdrop style={{ zIndex: 140 }}>
              <Modal.Container placement="center" size="sm">
                <div className="contents" onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setConfirmReset(false);
                  }
                }}>
                <Modal.Dialog aria-describedby={resetDescriptionId} data-testid="practice-reset-modal" role="alertdialog">
                  <Modal.Header><Modal.Heading>重置代码？</Modal.Heading></Modal.Header>
                  <Modal.Body>
                    <p className="text-sm leading-6 text-muted" id={resetDescriptionId}>这会将当前题目在 {mode === "acm" ? "ACM" : "LeetCode"} 模式下的 {LANGUAGES.find((entry) => entry.id === language)?.label} 草稿{mode === "acm" ? "清空" : "恢复为默认模板"}，现有内容会被替换。</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button autoFocus onPress={() => setConfirmReset(false)} variant="secondary">取消</Button>
                    <Button onPress={() => changeCode(starter)} variant="danger">确认重置</Button>
                  </Modal.Footer>
                </Modal.Dialog>
                </div>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </div>
      </div>
      <CodeEditor code={code} hints={hints} language={language} onChange={changeCode} ready={ready} />
      {/* 浏览器里的 TypeScript 只转译、不做类型检查（ROADMAP 阶段 0）。真做类型检查要带上 lib.*.d.ts，以后再加 */}
      {language === "typescript" && <p className="border-t border-separator px-4 py-2 text-[11px] leading-5 text-muted" data-testid="practice-ts-note">TypeScript 在这里只转成 JavaScript 运行，不做类型检查：类型写错不会报错，提交到力扣时会报编译错误。</p>}
      {panelOpen && <ResizeHandle axis="y" className="practice-console-handle" container={() => document.getElementById("practice")} fallback={0.4} invert label="调整控制台高度" max={0.75} min={0.15} onChange={setConsoleSize} onCommit={commitConsole} value={consoleSize} />}
      <div className="practice-run-controls flex flex-wrap items-center justify-end gap-2 border-y border-separator px-4 py-3">
        {canRecord && <Switch className="mr-auto" isSelected={recordOn} onChange={changeRecord} size="sm">
          <Switch.Content className="flex-row items-center gap-2">
            <Switch.Control><Switch.Thumb /></Switch.Control>
            <span className="text-xs text-muted" title={`「测试全部」的结果记进 ${session?.repo?.name ?? "进度仓"}：每次一条尝试记录，全部通过时另存一份题解`}>记进进度仓</span>
          </Switch.Content>
        </Switch>}
        <div className="flex gap-2">
          {running ? <Button onPress={() => { setStatus("正在停止…"); abortRef.current?.abort(); }} size="sm" variant="danger-soft"><span aria-hidden className="size-2 rounded-[1px] bg-current" />停止运行</Button> : <><Button isDisabled={!ready} onPress={() => void execute(problem.cases, false, true)} size="sm" variant="outline">测试全部 · {problem.cases.length}</Button><Button isDisabled={!ready} onPress={() => { if (tab === "custom") runCustom(); else void execute(samples); }} size="sm"><PlayIcon />{tab === "custom" ? "运行自定义" : "运行示例"}</Button></>}
        </div>
      </div>
      {panelOpen && <div className="practice-console" data-testid="practice-test-panel">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <Segment aria-label="测试面板" onSelectionChange={(key) => setTab(String(key) as TestTab)} selectedKey={tab} size="sm" variant="ghost">
            <Segment.Item id="examples">示例</Segment.Item><Segment.Item id="custom">自定义</Segment.Item><Segment.Item id="results">运行结果</Segment.Item>
          </Segment>
          <span className="font-pixel text-[9px] tracking-wider text-muted">TEST</span>
        </div>
        {error && <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2.5 text-xs leading-5 text-danger" role="alert">{error}</p>}
        {tab === "examples" && <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1.5">{samples.map((_, index) => <button aria-pressed={sample === index} className={clsx("rounded-md px-2.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-accent", sample === index ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-secondary")} key={index} onClick={() => setSample(index)} type="button">示例 {index + 1}</button>)}</div><Button onPress={() => { setCustomInput(selectedSample.stdin); setCustomFields(practiceInputFields(problem, selectedSample.input)); setCustomExpected(mode === "leetcode" ? formatPracticeValue(selectedSample.expected) : selectedSample.stdout); setError(null); setTab("custom"); }} size="sm" variant="ghost">编辑此用例</Button></div>
          <div className="flex min-w-0 flex-col gap-3"><div className="min-w-0"><p className="mb-1.5 text-[11px] text-muted">{mode === "leetcode" ? "输入" : "标准输入"}</p><pre className="practice-output" data-testid="practice-example-input">{mode === "leetcode" ? formatPracticeInput(problem, selectedSample) : selectedSample.stdin}</pre></div><div className="min-w-0"><p className="mb-1.5 text-[11px] text-muted">{mode === "leetcode" ? "预期结果" : "标准输出"}</p><pre className="practice-output" data-testid="practice-example-output">{mode === "leetcode" ? formatPracticeResult(problem, selectedSample.expected) : selectedSample.stdout}</pre></div></div>
        </div>}
        {tab === "custom" && <div className="flex flex-col gap-3">
          <p className="text-xs leading-5 text-muted">{mode === "leetcode" ? "每个参数分别填写 JSON，字符串需使用双引号。预期结果留空时只运行。" : "按照左侧题面填写标准输入；预期标准输出留空时只运行。"}</p>
          {mode === "leetcode" ? <div className="grid gap-3 sm:grid-cols-2">{customFields.map((field, index) => <label className="flex min-w-0 flex-col gap-1.5 font-mono text-xs text-muted" key={field.key}>{field.label}<TextArea aria-label={`自定义参数 ${field.label}`} className="w-full font-mono text-xs" disabled={running} onChange={(event) => setCustomFields((fields) => fields.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} rows={2} value={field.value} variant="secondary" /></label>)}</div> : <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">标准输入<TextArea aria-label="自定义输入" className="min-h-28 w-full font-mono text-xs" disabled={running} onChange={(event) => setCustomInput(event.target.value)} rows={5} value={customInput} variant="secondary" /></label>}
          <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">{mode === "leetcode" ? "预期结果（JSON，可选）" : "预期标准输出（可选）"}<TextArea aria-label="自定义预期结果" className="w-full font-mono text-xs" disabled={running} onChange={(event) => setCustomExpected(event.target.value)} rows={3} value={customExpected} variant="secondary" /></label>
        </div>}
        {tab === "results" && !running && record && <RecordLine record={record} />}
        {tab === "results" && (running ? <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-6" role="status"><span aria-hidden className="bullet-blink size-2 shrink-0 rounded-[2px] bg-accent" /><p className="text-xs leading-5 text-muted">{status}</p></div> : report ? <PracticeResults problem={problem} cases={report.cases} key={report.result.duration} mode={mode} result={report.result} stale={report.code !== code} unchecked={report.unchecked} /> : <p className="py-5 text-center text-xs leading-6 text-muted">运行代码后，在这里查看每个用例的结果。</p>)}
      </div>
      </div>}
    </Card>
  );
}

/** 「测试全部」记进进度仓的结果：写了哪条尝试记录、有没有另存题解、状态改成了什么 */
function RecordLine({ record }: { record: RecordState }) {
  if (record.state === "saving") return <p className="text-xs leading-5 text-muted" data-testid="practice-record" role="status">正在记进进度仓…</p>;
  if (record.state === "error") return <p className="text-xs leading-5 text-warning" data-testid="practice-record" role="status">没记进进度仓：{record.message}</p>;
  const file = (path: string) => path.split("/").pop();
  return (
    <p className="text-xs leading-5 text-muted" data-testid="practice-record" role="status">
      已记进进度仓：尝试记录 <span className="whitespace-nowrap font-mono text-foreground">{file(record.attempt)}</span>
      {record.solution && <>，题解另存为 <span className="whitespace-nowrap font-mono text-foreground">{file(record.solution)}</span></>}
      {record.status && <>，状态改成「{record.status}」</>}
      {record.url && <> · <a className="text-accent underline-offset-2 hover:underline" href={record.url} rel="noreferrer" target="_blank">查看提交</a></>}
    </p>
  );
}

function ExpandIcon({ collapsed }: { collapsed: boolean }) {
  return <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="14"><path d={collapsed ? "M1.5 5h3.5V1.5M5 5 1.5 1.5M14.5 11H11v3.5M11 11l3.5 3.5" : "M5 1.5H1.5V5M1.5 1.5 5 5M11 14.5h3.5V11M14.5 14.5 11 11"} /></svg>;
}

function ResetIcon() {
  return <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="16"><path d="M2.5 5.5A5.5 5.5 0 1 1 2 9M2 2v4h4" /></svg>;
}
