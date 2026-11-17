"use client";

import { Button, Card, ListBox, Modal, Select, TextArea } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { CodeIcon, PlayIcon } from "@/components/icons";
import { PixelLoader, Skel } from "@/components/pixel";
import { PracticeModeSwitch, PracticeStatement, usePractice } from "@/components/practice/context";
import { PracticeResults } from "@/components/practice/results";
import { decodeAcmInput, encodeAcmInput, encodeAcmOutput, parseAcmOutput } from "@/lib/practice/acm";
import { runPractice } from "@/lib/practice/runner";
import type { PracticeCase, PracticeLanguage, PracticeMode, PracticeProblem, PracticeRunResult } from "@/lib/practice/types";
import { formatPracticeInput, formatPracticeResult, formatPracticeValue, parsePracticeFields, practiceInputFields, starterHash, type PracticeInputField } from "@/lib/practice/format";

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

export function PracticeWorkbench() {
  const { detail, problem, error, retry, mode, language, select } = usePractice();
  const [focusPhase, setFocusPhase] = useState<"closed" | "open" | "closing">("closed");
  const active = focusPhase !== "closed";
  const reducedMotion = useReducedMotion();
  const focusButton = useRef<HTMLButtonElement>(null);
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
      focusButton.current?.focus({ preventScroll: true });
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

  return (
    <aside
      aria-label={active ? "代码专注模式" : "代码练习"}
      aria-modal={active ? true : undefined}
      className={clsx("practice-sidebar practice-shell", active && "practice-shell--focus", focusPhase === "closing" && "practice-shell--closing")}
      data-focus-phase={focusPhase}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget && focusPhase === "closing") flushSync(finishClosing); }}
      role={active ? "dialog" : undefined}
    >
      <section aria-label="专注题面" className="practice-focus-statement" hidden={!active} key="statement">
        <div className="practice-focus-statement-heading"><span className="font-mono text-xs text-muted">{detail.summary.id}.</span><h2 className="text-base font-bold">{detail.summary.name}</h2></div>
        <div className="practice-focus-statement-body"><PracticeStatement /></div>
      </section>
      <div className="practice-editor-column" key="editor">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
          <PracticeModeSwitch />
          <Button aria-label={active ? "退出专注模式" : "进入专注模式"} isDisabled={focusPhase === "closing"} onPress={() => { if (active) closeFocus(); else setFocusPhase("open"); }} ref={focusButton} size="sm" variant="ghost"><ExpandIcon collapsed={active} />{active ? "退出专注" : "专注模式"}</Button>
        </div>
        {problem ? <PracticeSession key={`${problem.id}:${mode}:${language}`} language={language} mode={mode} onLanguageChange={(value) => select(mode, value)} problem={problem} /> : (
          <Card className="min-w-0 items-center justify-center gap-4 px-6 py-14">
            {error ? <><p className="text-sm text-danger" role="alert">{error}</p><Button onPress={retry} size="sm" variant="outline">重新加载练习</Button></> : <><CodeIcon height={24} width={24} /><p className="text-sm text-muted">正在准备练习…</p><Skel className="h-56 w-full rounded-2xl" /></>}
          </Card>
        )}
      </div>
    </aside>
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
  const [confirmReset, setConfirmReset] = useState(false);
  const resetDescriptionId = useId();
  const [tab, setTab] = useState<TestTab>("results");
  const [panelOpen, setPanelOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const [sample, setSample] = useState(0);
  const [customInput, setCustomInput] = useState(samples[0].stdin);
  const [customFields, setCustomFields] = useState<PracticeInputField[]>(() => practiceInputFields(problem, samples[0].input));
  const [customExpected, setCustomExpected] = useState(mode === "leetcode" ? formatPracticeValue(samples[0].expected) : samples[0].stdout);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ result: PracticeRunResult; cases: PracticeCase[]; code: string; unchecked: boolean } | null>(null);
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

  const execute = useCallback(async (cases: PracticeCase[], unchecked = false) => {
    if (!ready || running || abortRef.current || !cases.length) return;
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
      if (sequenceRef.current === token) setReport({ result, cases, code: snapshot, unchecked });
    } catch (e) {
      if (sequenceRef.current === token) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (sequenceRef.current === token) { setRunning(false); abortRef.current = null; }
    }
  }, [language, mode, problem, ready, running]);

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
    <Card className="min-w-0 gap-0 overflow-hidden p-0" id="practice" onKeyDownCapture={(event) => {
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
      <CodeEditor code={code} language={language} onChange={changeCode} ready={ready} />
      <div className="practice-run-controls flex justify-end gap-2 border-y border-separator px-4 py-3">
        <div className="flex gap-2">
          {running ? <Button onPress={() => { setStatus("正在停止…"); abortRef.current?.abort(); }} size="sm" variant="danger-soft"><span aria-hidden className="size-2 rounded-[1px] bg-current" />停止运行</Button> : <><Button isDisabled={!ready} onPress={() => void execute(problem.cases)} size="sm" variant="outline">测试全部 · {problem.cases.length}</Button><Button isDisabled={!ready} onPress={() => { if (tab === "custom") runCustom(); else void execute(samples); }} size="sm"><PlayIcon />{tab === "custom" ? "运行自定义" : "运行示例"}</Button></>}
        </div>
      </div>
      <AnimatePresence initial={false}>
      {panelOpen && <motion.div animate={{ height: "auto", opacity: 1 }} className="overflow-hidden" data-testid="practice-test-panel" initial={{ height: 0, opacity: 0 }} key="test-panel" transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}>
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
        {tab === "results" && (running ? <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-6" role="status"><span aria-hidden className="bullet-blink size-2 shrink-0 rounded-[2px] bg-accent" /><p className="text-xs leading-5 text-muted">{status}</p></div> : report ? <PracticeResults problem={problem} cases={report.cases} key={report.result.duration} mode={mode} result={report.result} stale={report.code !== code} unchecked={report.unchecked} /> : <p className="py-5 text-center text-xs leading-6 text-muted">运行代码后，在这里查看每个用例的结果。</p>)}
      </div>
      </motion.div>}
      </AnimatePresence>
    </Card>
  );
}

function ExpandIcon({ collapsed }: { collapsed: boolean }) {
  return <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="14"><path d={collapsed ? "M1.5 5h3.5V1.5M5 5 1.5 1.5M14.5 11H11v3.5M11 11l3.5 3.5" : "M5 1.5H1.5V5M1.5 1.5 5 5M11 14.5h3.5V11M14.5 14.5 11 11"} /></svg>;
}

function ResetIcon() {
  return <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="16"><path d="M2.5 5.5A5.5 5.5 0 1 1 2 9M2 2v4h4" /></svg>;
}
