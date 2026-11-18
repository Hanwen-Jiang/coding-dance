"use client";

import { Button, ButtonGroup, Card, Dropdown, ListBox, Modal, Select, TextArea } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

import { ChevronDown, CodeIcon, DocIcon, PlayIcon } from "@/components/icons";
import { PixelCodeMark, PixelLoader, Skel } from "@/components/pixel";
import { PracticeModeSwitch, PracticeStatement, usePractice } from "@/components/practice/context";
import { type DebugRun, PracticeDebugger } from "@/components/practice/debugger";
import { PracticeResults } from "@/components/practice/results";
import { ResizeHandle, useMedia, useStoredFraction } from "@/components/practice/resize";
import { decodeAcmInput, encodeAcmInput, encodeAcmOutput, parseAcmOutput } from "@/lib/practice/acm";
import { usePracticeDock } from "@/lib/practice/dock";
import { runPractice } from "@/lib/practice/runner";
import { PRACTICE_SAVED_EVENT, practiceSaves, type SaveJobState } from "@/lib/practice/save-queue";
import type { PracticeCase, PracticeHints, PracticeLanguage, PracticeMode, PracticeProblem, PracticeRunResult } from "@/lib/practice/types";
import { practiceVerdict } from "@/lib/practice/verdict";
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
type TestTab = "examples" | "custom" | "results" | "debug";
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
/**
 * 测试的两档，存在浏览器里（默认全量）：
 *   quick 精简边界：题目示例、预设和边界用例，几组就能确认代码跑得通；
 *   full 全量：再加上固定种子的随机用例，全部通过才算能当题解（只有全量测试会记进进度仓的尝试记录、通过时存成题解）。
 */
type TestLevel = "quick" | "full";
const LEVEL_KEY = "hot100:practice:test-level";
function readLevel(): TestLevel {
  try { return localStorage.getItem(LEVEL_KEY) === "quick" ? "quick" : "full"; } catch { return "full"; }
}
/** 精简边界：练习数据里标了 quick 的几组（示例、预设、边界）；旧数据没有标记时退回到题目示例 */
const quickCasesOf = (cases: PracticeCase[]) => {
  const quick = cases.filter((c) => c.quick);
  return quick.length ? quick : cases.filter((c) => c.source);
};
/** 长行自动折行（默认开），存在浏览器里；关掉就是一行到底、横向滚动 */
const WRAP_KEY = "hot100:practice:wrap";
function readWrap() {
  try { return localStorage.getItem(WRAP_KEY) !== "off"; } catch { return true; }
}
/** 停下不改多久之后自动把草稿存进进度仓（每存一次是一个 commit，所以不要太勤） */
const AUTOSAVE_MS = 60_000;
/** 比较两份代码时不管换行符和末尾空白（服务端存的时候会统一成这样） */
const tidyCode = (code: string) => code.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
/** 存进进度仓的队列里某一项的状态（草稿、记录各一项） */
function useSaveState(key: string) {
  const subscribe = useCallback((fn: () => void) => practiceSaves().subscribe(fn), []);
  return useSyncExternalStore(subscribe, () => practiceSaves().state(key), () => undefined);
}
const clock = (at: number) => new Date(at).toTimeString().slice(0, 5);
/**
 * 专注模式里题面的三种状态：split 题面和代码都在；folded 题面收起，只留标题栏（并排时收成一条窄边）；
 * only 只看题面（上下排列时代码区只留顶上那一行工具条）。
 */
type StatementView = "split" | "folded" | "only";

/**
 * 桌面（≥1200）页面右侧的练习区展开还是收起，记在浏览器里，换题、刷新都不变。
 * 状态写在 <html data-practice> 上，样式全靠它（practice.css）；layout.tsx 在首屏前就按存的值设好，避免先展开再收起的闪动。
 */

/**
 * 桌面上练习区占多宽：占整行（题目页的 grid）的比例，拖正文和练习区之间的竖条调整，存在浏览器里。
 * 写在 <html> 的 --practice-dock 上（practice.css 按它排三列），layout.tsx 首屏前就按存的值设好，刷新时不会先按默认宽度画再跳。
 * 范围：练习区至少 360px，正文至少留 560px（加上 24px 的拖动条）；CSS 里也用 clamp 兜底。
 */
export const DOCK_SIZE_KEY = "hot100:practice:dock-size";
const DOCK_DEFAULT = 0.38;
function useDockSize() {
  const [size, setSize, commit] = useStoredFraction(DOCK_SIZE_KEY, DOCK_DEFAULT, 0.15, 0.8);
  // 整行有多宽：和 practice.css 的 width: min(1744px, 100vw - 48px) 一致
  const [row, setRow] = useState(1152);
  useEffect(() => {
    const update = () => setRow(Math.min(1744, window.innerWidth - 48));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const min = Math.min(0.5, 360 / row), max = Math.max(min, (row - 584) / row);
  // 只在用户拖、按键、双击时改 CSS 变量；首屏的值由 layout.tsx 设好，这里不去覆盖
  const change = useCallback((v: number) => { setSize(v); document.documentElement.style.setProperty("--practice-dock", String(Math.round(v * 1000) / 1000)); }, [setSize]);
  // 往右拖过最小宽度再 80px：整块收进右边那条窄边里
  return { value: Math.min(max, Math.max(min, size)), min, max, change, commit, collapseBelow: (360 - 80) / row };
}

export function PracticeWorkbench() {
  const { detail, problem, error, retry, mode, language, select } = usePractice();
  const [docked, setDocked] = usePracticeDock();
  const dock = useDockSize();
  const desktop = useMedia("(min-width: 1200px)");
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
  // 桌面上收起时侧栏还在页面里（编辑器的内容和撤销记录都留着），只是看不见、也不能用键盘进去
  const stowed = desktop && !docked && !active;
  const dockButton = useRef<HTMLButtonElement>(null);
  const rail = useRef<HTMLButtonElement>(null);
  const stow = () => { setDocked(false); requestAnimationFrame(() => rail.current?.focus({ preventScroll: true })); };
  const summon = () => { setDocked(true); requestAnimationFrame(() => dockButton.current?.focus({ preventScroll: true })); };
  /*
   * 收起后右边的像素把手：点一下、或者按住往左拖就展开。拖的时候把手跟着手走（越拖越沉），
   * 拖过 RAIL_PULL 就展开；没拖够松手弹回去。展开时把手先往左一跳、淡出，练习区紧接着从右边滑进来。
   */
  const RAIL_PULL = 56;
  const railDrag = useRef<{ x: number; moved: boolean } | null>(null);
  const railMoved = useRef(false);
  const [railState, setRailState] = useState<"idle" | "drag" | "leaving">("idle");
  const setRailPull = (px: number | null) => { if (px === null) rail.current?.style.removeProperty("--rail-pull"); else rail.current?.style.setProperty("--rail-pull", `${px}px`); };
  const summonFromRail = () => {
    railDrag.current = null;
    if (reducedMotion) { setRailPull(null); setRailState("idle"); summon(); return; }
    setRailState("leaving");
    window.setTimeout(() => { summon(); setRailState("idle"); setRailPull(null); }, 150);
  };
  return (
    <>
    {/* 正文和练习区之间的竖条：左右拖调整练习区宽度，方向键也行，双击恢复默认；往右拖过最小宽度就收进右边（桌面并排、练习区展开时才有） */}
    <ResizeHandle
      axis="x"
      className="practice-dock-handle"
      collapseBelow={dock.collapseBelow}
      container={() => shell.current?.parentElement ?? null}
      fallback={DOCK_DEFAULT}
      hidden={!desktop || !docked || active}
      invert
      label="调整练习区宽度"
      max={dock.max}
      min={dock.min}
      onChange={dock.change}
      onCollapse={stow}
      onCommit={dock.commit}
      value={dock.value}
    />
    <aside
      aria-label={active ? "代码专注模式" : "代码练习"}
      aria-modal={active ? true : undefined}
      className={clsx("practice-sidebar practice-shell", active && "practice-shell--focus", focusPhase === "closing" && "practice-shell--closing")}
      data-focus-phase={focusPhase}
      data-statement={statementView}
      inert={stowed || undefined}
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
                {!folded && <Button aria-label="只看题目" className="practice-only-toggle" onPress={() => setStatementView("only")} size="sm" variant="ghost"><DocIcon /><span className="practice-heading-label">只看题目</span></Button>}
                <Button aria-controls={statementBodyId} aria-expanded={!folded} aria-label={folded ? "展开题目" : "收起题目"} className="practice-fold-toggle" onPress={() => setStatementView(folded ? "split" : "folded")} size="sm" variant="ghost">
                  <ChevronDown className={clsx("practice-fold-icon transition-transform", folded && "-rotate-90")} />
                  <span className="practice-fold-label">{folded ? "展开题目" : "收起"}</span>
                </Button>
              </>
            )}
            {/* 手机上「退出」放在屏幕最上面这一行的最右边，最显眼；并排（≥1024）时用代码那边的「退出专注」 */}
            <Button aria-label="退出专注模式" className="practice-focus-exit-top" isDisabled={focusPhase === "closing"} onPress={closeFocus} size="sm" variant="secondary"><ExpandIcon collapsed />退出</Button>
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
          <div className="flex items-center gap-1">
            <Button aria-label={active ? "退出专注模式" : "进入专注模式"} className={clsx(active && "practice-focus-exit-row")} isDisabled={focusPhase === "closing"} onPress={() => { if (active) closeFocus(); else openFocus(); }} ref={focusButton} size="sm" variant="ghost"><ExpandIcon collapsed={active} />{active ? "退出专注" : "专注模式"}</Button>
            {/* 桌面上可以把练习区收起来，页面回到和首页一样宽；右边留一条窄边，点它或往左拖再展开 */}
            {desktop && !active && <Button aria-label="收起练习区" onPress={stow} ref={dockButton} size="sm" variant="ghost"><StowIcon />收起</Button>}
          </div>
        </div>
        {problem ? <PracticeSession key={`${problem.id}:${mode}:${language}`} language={language} mode={mode} onLanguageChange={(value) => select(mode, value)} problem={problem} /> : (
          <Card className="min-w-0 items-center justify-center gap-4 px-6 py-14">
            {error ? <><p className="text-sm text-danger" role="alert">{error}</p><Button onPress={retry} size="sm" variant="outline">重新加载练习</Button></> : <><CodeIcon height={24} width={24} /><p className="text-sm text-muted">正在准备练习…</p><Skel className="h-56 w-full rounded-2xl" /></>}
          </Card>
        )}
      </div>
    </aside>
    {/* 1200px 以下页面里不放编辑器：右下角一个只有图标的圆按钮「写代码」，点开是全屏的题面 + 编辑器（显示规则见 practice.css） */}
    <div className="practice-launcher" hidden={active}>
      <Button isIconOnly aria-label="写代码" className="practice-launcher-button" onPress={openFocus} ref={launcher}>
        <CodeIcon height={20} width={20} />
      </Button>
    </div>
    {/*
      桌面上练习区收起时：屏幕右边若隐若现的一个像素「<」。鼠标移上去（或键盘聚焦、拖动时）「<」往左跳开，
      「/」「>」一格一格蹦出来成「</>」，稍后下面一个字母一个字母跳出「coding」；点一下或按住往左拖就展开练习区。
    */}
    <button
      aria-label="展开练习区"
      className={clsx("practice-rail", railState === "drag" && "is-dragging", railState === "leaving" && "is-leaving")}
      hidden={!stowed}
      onClick={() => { if (!railMoved.current && railState !== "leaving") summonFromRail(); railMoved.current = false; }}
      onPointerCancel={() => { railDrag.current = null; setRailPull(null); setRailState("idle"); }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        railDrag.current = { x: e.clientX, moved: false };
        railMoved.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = railDrag.current;
        if (!d) return;
        const dx = d.x - e.clientX;
        if (!d.moved && Math.abs(dx) > 4) { d.moved = true; railMoved.current = true; setRailState("drag"); }
        if (!d.moved) return;
        if (dx > RAIL_PULL) { summonFromRail(); return; }
        // 跟着手往左走，越拖越沉；往右拖不动
        setRailPull(-Math.max(0, dx) * 0.6);
      }}
      onPointerUp={() => {
        if (railDrag.current?.moved) { setRailPull(null); setRailState("idle"); }
        railDrag.current = null;
      }}
      ref={rail}
      title="展开练习区（点一下或往左拖）"
      type="button"
    >
      <PixelCodeMark className="practice-rail-mark" />
      <span aria-hidden className="practice-rail-label font-pixel">
        {[..."coding"].map((ch, i) => <span key={i} style={{ "--i": i } as React.CSSProperties}>{ch}</span>)}
      </span>
    </button>
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
  const [level, setLevel] = useState<TestLevel>(readLevel);
  const changeLevel = (next: TestLevel) => { setLevel(next); try { localStorage.setItem(LEVEL_KEY, next); } catch { /* 这次仍然生效 */ } };
  const quickCases = useMemo(() => quickCasesOf(problem.cases), [problem]);
  const [wrap, setWrap] = useState(readWrap);
  const toggleWrap = () => setWrap((on) => { try { localStorage.setItem(WRAP_KEY, on ? "off" : "on"); } catch { /* 这次仍然生效 */ } return !on; });
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
  // 调试：一组输入的执行记录、当前看到第几步、编辑器里的断点；调试用的输入跟着上一次看的是「示例」还是「自定义」
  const [debugRun, setDebugRun] = useState<DebugRun | null>(null);
  const [debugIndex, setDebugIndex] = useState(0);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const caseTab = useRef<"examples" | "custom">("examples");
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

  // —— 存进用户自己的进度仓（要登录并开通）：草稿（Ctrl+S、停下 60 秒后自动存）和「测试全部」的记录，都走 save-queue 排队 ——
  const { ready: repoReady, refresh: refreshProgress } = useProgress();
  const draftJob = `draft:${problem.id}:${mode}:${language}`;
  const runJob = `run:${problem.id}:${mode}:${language}`;
  const draftState = useSaveState(draftJob);
  const runState = useSaveState(runJob);
  /** 上一次和进度仓对上的那份草稿的指纹：本地改过之后它就对不上了，说明有没存的改动 */
  const syncedKey = `${draftKey}:synced`;
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [remoteDraft, setRemoteDraft] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 5000); return () => clearTimeout(t); }, [flash]);
  const readSynced = () => { try { return localStorage.getItem(syncedKey); } catch { return null; } };
  const markSynced = (value: string) => { try { localStorage.setItem(syncedKey, starterHash(tidyCode(value))); } catch { /* 下次多存一遍而已 */ } };

  const saveDraft = (manual: boolean) => {
    if (autosave.current) { clearTimeout(autosave.current); autosave.current = null; }
    if (!repoReady) { if (manual) setFlash("草稿已存在这个浏览器里。登录并开通进度仓后，Ctrl+S 会把它存进你的进度仓。"); return; }
    const snapshot = codeRef.current;
    if (tidyCode(snapshot) === tidyCode(starter)) { if (manual) setFlash("还是模板，没有要存的。"); return; }
    if (readSynced() === starterHash(tidyCode(snapshot))) { if (manual) setFlash("进度仓里已经是这一版了。"); return; }
    setFlash(null);
    void practiceSaves().push(draftJob, { kind: "draft", id: problem.id, lang: language, mode, code: snapshot }, true).then((res) => { if (res) markSynced(snapshot); });
  };
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  // 切到后台、关掉页面、换题换语言时，还没自动存的改动马上存
  useEffect(() => {
    const now = () => { if (autosave.current) { saveDraftRef.current(false); practiceSaves().flush(); } };
    const onVisibility = () => { if (document.visibilityState === "hidden") now(); };
    window.addEventListener("pagehide", now);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", now);
      document.removeEventListener("visibilitychange", onVisibility);
      if (autosave.current) saveDraftRef.current(false);
    };
  }, []);

  /** 换掉编辑器里的代码，但不当作用户的改动（不触发自动保存） */
  const applyCode = (value: string) => {
    setCode(value);
    codeRef.current = value;
    try { localStorage.setItem(draftKey, value); } catch { /* 保留当前编辑内容。 */ }
  };

  // 打开时看一眼进度仓里有没有这道题的草稿（可能是在别的设备上写的）：本地没改过就直接换上，改过就问一下
  useEffect(() => {
    if (!ready || !repoReady) return;
    let alive = true;
    fetch(`/api/progress/practice?id=${problem.id}&lang=${language}&mode=${mode}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ code?: string | null }>) : null))
      .then((j) => {
        if (!alive || !j?.code) return;
        const remote = tidyCode(j.code), local = tidyCode(codeRef.current);
        if (remote === local) { markSynced(remote); return; }
        if (local === tidyCode(starter) || readSynced() === starterHash(local)) { applyCode(remote); markSynced(remote); setFlash("已载入进度仓里的草稿。"); }
        else setRemoteDraft(remote);
      })
      .catch(() => { /* 读不到就用本地的 */ });
    return () => { alive = false; };
  }, [ready, repoReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 「测试全部」跑完：记一条尝试记录，全部通过再存成题解；写好后题目页的两节重新读，状态变了就刷新进度 */
  const recordRun = (run: PracticeRunResult, cases: PracticeCase[], snapshot: string) => {
    if (!repoReady) return;
    const verdict = practiceVerdict(problem, mode, cases, run);
    if (!verdict) return;
    void practiceSaves().push(runJob, { kind: "run", id: problem.id, lang: language, mode, code: snapshot, duration: run.duration, ...verdict }, false).then((res) => {
      if (!res) return;
      window.dispatchEvent(new CustomEvent(PRACTICE_SAVED_EVENT, { detail: { id: problem.id } }));
      if (res.status) void refreshProgress();
    });
  };
  const recordRef = useRef(recordRun);
  recordRef.current = recordRun;

  const changeCode = (value: string) => {
    setCode(value);
    codeRef.current = value;
    setConfirmReset(false);
    try { localStorage.setItem(draftKey, value); } catch { /* 保留当前编辑内容。 */ }
    if (repoReady) {
      if (autosave.current) clearTimeout(autosave.current);
      autosave.current = setTimeout(() => saveDraftRef.current(false), AUTOSAVE_MS);
    }
  };

  const execute = useCallback(async (cases: PracticeCase[], unchecked = false) => {
    if (!ready || running || abortRef.current || !cases.length) return;
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
      if (sequenceRef.current === token) setReport({ result, cases, code: snapshot, unchecked });
      // 「测试全部」相当于一次提交：记进进度仓的尝试记录（示例、自定义用例只是运行，不记）
      if (cases === problem.cases && !unchecked) recordRef.current(result, cases, snapshot);
    } catch (e) {
      if (sequenceRef.current === token) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (sequenceRef.current === token) { setRunning(false); abortRef.current = null; }
    }
  }, [language, mode, problem, ready, running, starter]);

  /** 按「自定义」里填的内容拼一组用例；填得不对抛出中文错误 */
  const customCase = (): { test: PracticeCase; unchecked: boolean } => {
    const input: unknown = mode === "leetcode" ? parsePracticeFields(problem, customFields) : decodeAcmInput(customInput, problem.signature);
    if (!Array.isArray(input)) throw new Error("请检查输入参数。");
    if (!problem.signature.cls && input.length !== problem.signature.params?.length) throw new Error(`这道题需要 ${problem.signature.params?.length || 0} 个参数，请将它们放在同一个数组中。`);
    if (problem.signature.cls && (input.length !== 2 || !Array.isArray(input[0]) || !Array.isArray(input[1]))) throw new Error("设计类题的输入是 [操作名数组, 参数数组]。");
    const unchecked = !customExpected.trim();
    const expected: unknown = unchecked ? undefined : mode === "leetcode" ? JSON.parse(customExpected) : parseAcmOutput(customExpected, problem.signature);
    return {
      unchecked,
      test: {
        input,
        expected,
        stdin: mode === "acm" ? customInput : encodeAcmInput(input, problem.signature),
        stdout: unchecked ? "" : mode === "acm" ? customExpected : encodeAcmOutput(expected, problem.signature),
        label: "自定义用例",
      },
    };
  };
  const runCustom = () => {
    try {
      const { test, unchecked } = customCase();
      void execute([test], unchecked);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  /** 调试：用当前的示例（或者自定义输入）跑一遍，记下每一步，在「调试」里一步步看 */
  const runDebug = async () => {
    if (!ready || running || abortRef.current) return;
    let test: PracticeCase;
    try {
      test = caseTab.current === "custom" ? customCase().test : samples[Math.min(sample, samples.length - 1)];
    } catch (e) { setPanelOpen(true); setError(e instanceof Error ? e.message : String(e)); return; }
    if (codeRef.current.trim() === starter.trim()) {
      setPanelOpen(true);
      setTab("debug");
      setError(mode === "acm" ? "还没写程序：先写好读入、计算和输出，再调试。" : "还没写解法：在模板的方法里补上代码，再调试。");
      return;
    }
    const token = ++sequenceRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const snapshot = codeRef.current;
    setError(null);
    setStatus("正在调试：记下每一步…");
    setPanelOpen(true);
    setRunning(true);
    setTab("debug");
    try {
      const result = await runPractice({ problem, language, mode, code: snapshot, cases: [test], debug: true }, {
        signal: controller.signal,
        onStatus: (value) => { if (sequenceRef.current === token) setStatus(value); },
      });
      if (sequenceRef.current !== token) return;
      const r = result.results[0];
      setDebugRun({ trace: r?.trace ?? null, stdout: r?.stdout ?? "", error: r?.error, code: snapshot, label: test.label || (caseTab.current === "custom" ? "自定义用例" : `示例 ${sample + 1}`), cancelled: result.cancelled });
      // 有断点就直接停在第一个断点上，没有就从第一步开始
      const steps = r?.trace?.steps ?? [];
      const firstBreak = steps.findIndex((s) => s.event === "line" && breakpoints.includes(s.line));
      setDebugIndex(firstBreak >= 0 ? firstBreak : 0);
    } catch (e) {
      if (sequenceRef.current === token) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (sequenceRef.current === token) { setRunning(false); abortRef.current = null; }
    }
  };
  const debugging = tab === "debug" && !!debugRun && debugRun.code === code;
  const debugLine = debugging ? debugRun?.trace?.steps[Math.min(debugIndex, debugRun.trace.steps.length - 1)]?.line ?? null : null;

  const selectedSample = samples[Math.min(sample, samples.length - 1)];

  return (
    <Card className="min-w-0 gap-0 overflow-hidden p-0" id="practice" style={{ "--practice-console-size": `${consoleSize * 100}%` } as React.CSSProperties} onKeyDownCapture={(event) => {
      if (confirmReset) return;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat && !running) { if (tab === "custom") runCustom(); else void execute(samples); }
      }
      // Ctrl+S：把草稿存进进度仓（不弹浏览器的「另存网页」）
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) saveDraft(true);
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
          {/* 长行折行：默认开，按下去的样子表示开着 */}
          <Button aria-label="自动换行" aria-pressed={wrap} className={clsx(wrap && "bg-accent/10 text-accent")} isIconOnly onPress={toggleWrap} size="sm" variant="ghost">
            <span className="sr-only">{wrap ? "长行自动折到下一行，点一下改成不折行" : "长行不折行，点一下改成自动折行"}</span>
            <WrapIcon />
          </Button>
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
      {remoteDraft !== null && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-separator bg-warning/10 px-4 py-2 text-xs" role="status">
          <span className="leading-5">进度仓里有另一份草稿，可能是在别的设备上写的。</span>
          <span className="flex gap-1">
            <Button onPress={() => { applyCode(remoteDraft); markSynced(remoteDraft); setRemoteDraft(null); }} size="sm" variant="ghost">换成进度仓里的</Button>
            <Button onPress={() => setRemoteDraft(null)} size="sm" variant="ghost">留着现在的</Button>
          </span>
        </div>
      )}
      <CodeEditor code={code} debugLine={debugLine} hints={hints} language={language} onBreakpoints={setBreakpoints} onChange={changeCode} ready={ready} wrap={wrap} />
      {/* 浏览器里的 TypeScript 只转译、不做类型检查（ROADMAP 阶段 0）。真做类型检查要带上 lib.*.d.ts，以后再加 */}
      {language === "typescript" && <p className="border-t border-separator px-4 py-2 text-[11px] leading-5 text-muted" data-testid="practice-ts-note">TypeScript 在这里只转成 JavaScript 运行，不做类型检查：类型写错不会报错，提交到力扣时会报编译错误。</p>}
      {panelOpen && <ResizeHandle axis="y" className="practice-console-handle" container={() => document.getElementById("practice")} fallback={0.4} invert label="调整控制台高度" max={0.75} min={0.15} onChange={setConsoleSize} onCommit={commitConsole} value={consoleSize} />}
      <div className="practice-run-controls flex flex-wrap items-center justify-between gap-2 border-y border-separator px-4 py-3">
        <SaveStatus draft={draftState} flash={flash} repoReady={repoReady} run={runState} />
        <div className="ms-auto flex gap-2">
          {running ? <Button onPress={() => { setStatus("正在停止…"); abortRef.current?.abort(); }} size="sm" variant="danger-soft"><span aria-hidden className="size-2 rounded-[1px] bg-current" />停止运行</Button> : <>
            <Button aria-label={`调试（用${caseTab.current === "custom" ? "自定义输入" : `示例 ${sample + 1}`}，一步步看每一行和变量）`} isDisabled={!ready} onPress={() => void runDebug()} size="sm" variant="ghost"><BugIcon />调试</Button>
            <Button isDisabled={!ready} onPress={() => { if (tab === "custom") runCustom(); else void execute(samples); }} size="sm" variant="outline"><PlayIcon />{tab === "custom" ? "运行自定义" : "运行示例"}</Button>
            {/* 测试：主按钮跑当前这一档，右边的小箭头换档（精简边界 / 全量），选过的记在浏览器里 */}
            <ButtonGroup size="sm">
              <Button aria-label={level === "full" ? `全量测试，${problem.cases.length} 组用例，通过可当题解` : `精简边界测试，${quickCases.length} 组用例`} isDisabled={!ready} onPress={() => void execute(level === "full" ? problem.cases : quickCases)}>
                {level === "full" ? "全量测试" : "精简测试"} · {level === "full" ? problem.cases.length : quickCases.length}
              </Button>
              <Dropdown>
                <Button aria-label="选择测试档位" isDisabled={!ready} isIconOnly size="sm"><ButtonGroup.Separator /><ChevronDown /></Button>
                <Dropdown.Popover className="max-w-[300px]" placement="top end">
                  <Dropdown.Menu aria-label="测试档位" disallowEmptySelection onSelectionChange={(keys) => { const next = [...(keys as Set<string>)][0]; if (next === "quick" || next === "full") changeLevel(next); }} selectedKeys={new Set([level])} selectionMode="single">
                    <Dropdown.Item className="flex flex-col items-start gap-0.5" id="quick" textValue="精简边界测试">
                      <span className="flex w-full items-center justify-between gap-3 text-sm font-medium">精简边界测试<span className="font-mono text-xs text-muted">{quickCases.length} 组</span></span>
                      <span className="text-xs leading-5 text-muted">示例和边界用例，确认代码能跑通</span>
                    </Dropdown.Item>
                    <Dropdown.Item className="flex flex-col items-start gap-0.5" id="full" textValue="全量测试">
                      <span className="flex w-full items-center justify-between gap-3 text-sm font-medium">全量测试<span className="font-mono text-xs text-muted">{problem.cases.length} 组</span></span>
                      <span className="text-xs leading-5 text-muted">再加随机用例，全部通过才算能当题解{repoReady ? "；会记进尝试记录" : ""}</span>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </ButtonGroup>
          </>}
        </div>
      </div>
      {panelOpen && <div className="practice-console" data-testid="practice-test-panel">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <Segment aria-label="测试面板" onSelectionChange={(key) => { const next = String(key) as TestTab; if (next === "examples" || next === "custom") caseTab.current = next; setTab(next); }} selectedKey={tab} size="sm" variant="ghost">
            <Segment.Item id="examples">示例</Segment.Item><Segment.Item id="custom">自定义</Segment.Item><Segment.Item id="results">运行结果</Segment.Item><Segment.Item id="debug">调试</Segment.Item>
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
        {tab === "debug" && (running ? <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-6" role="status"><span aria-hidden className="bullet-blink size-2 shrink-0 rounded-[2px] bg-accent" /><p className="text-xs leading-5 text-muted">{status}</p></div> : debugRun ? <PracticeDebugger breakpoints={breakpoints} index={debugIndex} onIndex={setDebugIndex} run={debugRun} stale={debugRun.code !== code} /> : (
          <div className="flex flex-col items-center gap-3 py-5 text-center">
            <p className="max-w-sm text-xs leading-6 text-muted">点下面的「调试」，用{caseTab.current === "custom" ? "自定义输入" : `示例 ${sample + 1}`}把程序跑一遍，记下每一行执行时的变量，然后在这里一步步往前、往后看。行号左边点一下可以加断点。</p>
            <Button isDisabled={!ready} onPress={() => void runDebug()} size="sm" variant="outline"><BugIcon />开始调试</Button>
          </div>
        ))}
      </div>
      </div>}
    </Card>
  );
}

function ExpandIcon({ collapsed }: { collapsed: boolean }) {
  return <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="14"><path d={collapsed ? "M1.5 5h3.5V1.5M5 5 1.5 1.5M14.5 11H11v3.5M11 11l3.5 3.5" : "M5 1.5H1.5V5M1.5 1.5 5 5M11 14.5h3.5V11M14.5 14.5 11 11"} /></svg>;
}

/** 运行按钮左边的一行小字：草稿和「测试全部」的记录存到进度仓没有 */
function SaveStatus({ draft, run, flash, repoReady }: { draft?: SaveJobState; run?: SaveJobState; flash: string | null; repoReady: boolean }) {
  const parts: { text: string; tone?: "danger"; title?: string }[] = [];
  if (flash) parts.push({ text: flash });
  else {
    if (run?.phase === "queued" || run?.phase === "saving") parts.push({ text: "正在记进尝试记录…" });
    else if (run?.phase === "saved") parts.push({ text: run.res.solution ? "已记进尝试记录，并存成题解" : run.res.attempt ? "已记进尝试记录" : "记录已在进度仓里" });
    else if (run?.phase === "error") parts.push({ text: run.retrying ? "记录没存上，稍后重试" : "记录没存上", tone: "danger", title: run.error });
    if (draft?.phase === "queued" || draft?.phase === "saving") parts.push({ text: "正在存草稿…" });
    else if (draft?.phase === "saved") parts.push({ text: `草稿已存到进度仓 ${clock(draft.at)}` });
    else if (draft?.phase === "error") parts.push({ text: draft.retrying ? "草稿没存上，稍后重试" : "草稿没存上", tone: "danger", title: draft.error });
    if (!parts.length && repoReady) parts.push({ text: "Ctrl+S 存草稿 · 全量测试会记进尝试记录" });
  }
  if (!parts.length) return null;
  return (
    <p aria-live="polite" className="min-w-0 flex-1 truncate text-[11px] leading-5 text-muted" data-testid="practice-save-status">
      {parts.map((p, i) => <span className={clsx(p.tone === "danger" && "text-danger")} key={i} title={p.title}>{i > 0 && " · "}{p.text}{p.title ? `：${p.title}` : ""}</span>)}
    </p>
  );
}

/** 调试：一只小虫子 */
function BugIcon() {
  return <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="14"><rect height="8.5" rx="3.5" width="7" x="4.5" y="5" /><path d="M8 7.5v6M6 3.5 6.8 5M10 3.5 9.2 5M4.5 8H2M14 8h-2.5M4.5 11.5l-2 1.5M11.5 11.5l2 1.5M4.6 6.2 2.8 5M11.4 6.2 13.2 5" /></svg>;
}

/** 收起侧栏：一个框，右边一栏带向右的箭头 */
function StowIcon() {
  return <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="14"><rect height="12" rx="2" width="13" x="1.5" y="2" /><path d="M10 2v12M5 6l2 2-2 2" /></svg>;
}

/** 自动换行：一行字折回来 */
function WrapIcon() {
  return <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="16"><path d="M2 3.5h12M2 8h9.5a2.25 2.25 0 0 1 0 4.5H8M9.5 11 8 12.5 9.5 14M2 12.5h3.5" /></svg>;
}

function ResetIcon() {
  return <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="16"><path d="M2.5 5.5A5.5 5.5 0 1 1 2 9M2 2v4h4" /></svg>;
}
