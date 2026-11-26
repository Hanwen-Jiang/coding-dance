"use client";

// 调试面板：支持两种模式：
//   1) 录制回放（PracticeDebugger，Python / JS / TS 及云端录制模式）：跑完记下每一步变量与用户指定的表达式值，支持前进/后退/跳断点；
//   2) 实时 DAP（LiveDapDebugger，Java / C++ / Go 连接 /api/dap WebSocket）：真断点停住、单步执行、实时通过 DAP evaluate 计算追踪表达式。
import { Button } from "@heroui/react";
import clsx from "clsx";
import { type ReactNode, useId, useMemo, useState } from "react";

import type { DapSnapshot } from "@/lib/practice/dap-client";
import type { PracticeTrace, PracticeTraceStep } from "@/lib/practice/types";

export interface DebugRun {
  trace: PracticeTrace | null;
  stdout: string;
  error?: string;
  /** 调试时的代码（和现在编辑器里的不一样就是改过了） */
  code: string;
  /** 用的是哪组输入 */
  label: string;
  cancelled?: boolean;
}

/** 把记录里的值拆成「类型名」和「内容」：Counter({...})、defaultdict(...)、Map(3) {...} 这类前面带上类型 */
function split(value: string): { tag: string; body: string } {
  // 带长度的容器：JS 的 Map(3) / Set(3)，云端调试的 ArrayList(3)、vector(3)、map[int]int(3)、[]int(3) 这些
  const js = value.match(/^([A-Za-z_[][^\s(]*\(\d+\)) ([\s\S]*)$/);
  if (js) return { tag: js[1].replace("(", "·").replace(")", ""), body: js[2] };
  const py = value.match(/^([A-Za-z_][\w.]*)\(([\s\S]*)\)$/);
  if (py && !/^(ListNode|TreeNode|Node)$/.test(py[1])) return { tag: py[1], body: py[2] };
  return { tag: "", body: value };
}

function lookupWatchValue(step: PracticeTraceStep, name: string): string | undefined {
  const fromVar = step.vars.find(([k]) => k === name)?.[1];
  if (fromVar !== undefined) return fromVar;
  return step.watches?.find(([k]) => k === name)?.[1];
}

function isExpressionLike(name: string): boolean {
  return /[^\w$]/.test(name);
}

function WatchInputBar({
  watch,
  suggestions,
  onAdd,
  hint,
}: {
  watch: string[];
  suggestions: string[];
  onAdd: (expr: string) => void;
  hint?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const choices = useMemo(() => suggestions.filter((s) => !watch.includes(s)), [suggestions, watch]);

  const submit = () => {
    const expr = draft.trim();
    if (!expr) return;
    if (!watch.includes(expr) && watch.length < 20) {
      onAdd(expr);
    }
    setDraft("");
  };

  return (
    <form
      className="practice-watch-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        aria-label="输入变量或表达式追踪"
        className="practice-watch-input"
        data-testid="practice-watch-input"
        list={choices.length ? listId : undefined}
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={hint || "输入变量或表达式追踪（如 nums[i]、left + right）"}
        type="text"
        value={draft}
      />
      {choices.length > 0 && (
        <datalist id={listId}>
          {choices.map((name) => <option key={name} value={name} />)}
        </datalist>
      )}
      <button
        className="practice-watch-add"
        data-testid="practice-watch-add"
        disabled={!draft.trim() || watch.length >= 20}
        type="submit"
      >
        + 追踪
      </button>
    </form>
  );
}

export function PracticeDebugger({
  run,
  index,
  onIndex,
  breakpoints,
  stale,
  watch,
  onWatch,
  onRerunDebug,
  canRecordWatchExpr,
  modeToggle,
}: {
  run: DebugRun;
  index: number;
  onIndex: (index: number) => void;
  breakpoints: number[];
  stale: boolean;
  /** 钉住追踪的变量名或表达式 */
  watch: string[];
  onWatch: (names: string[]) => void;
  onRerunDebug?: () => void;
  canRecordWatchExpr?: boolean;
  modeToggle?: ReactNode;
}) {
  const steps = run.trace?.steps ?? [];
  const last = steps.length - 1;
  const at = Math.min(Math.max(index, 0), Math.max(last, 0));
  const step = steps[at];
  const prev = at > 0 ? steps[at - 1] : undefined;
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const changed = useMemo(() => {
    const before = new Map(prev?.vars ?? []);
    return new Set((step?.vars ?? []).filter(([k, v]) => prev && before.get(k) !== v).map(([k]) => k));
  }, [step, prev]);
  const allVarNames = useMemo(() => {
    const seen = new Set<string>();
    for (const s of steps) {
      for (const [k] of s.vars) seen.add(k);
    }
    return [...seen];
  }, [steps]);
  // 追踪：钉住的变量或表达式在哪几步变了（第一次出现也算），最多列 200 个点
  const history = useMemo(() => watch.map((name) => {
    const points: { at: number; value: string }[] = [];
    let before: string | undefined;
    let recordedInWatch = false;
    steps.forEach((s, i) => {
      if (s.watches?.some(([k]) => k === name)) recordedInWatch = true;
      const v = lookupWatchValue(s, name);
      if (v !== undefined && v !== before && points.length < 200) points.push({ at: i, value: v });
      before = v;
    });
    return { name, points, recordedInWatch };
  }), [watch, steps]);

  if (run.cancelled) return <p className="py-4 text-center text-xs text-muted">调试已停止。</p>;
  if (!step) {
    return (
      <div className="flex flex-col gap-2">
        {modeToggle}
        <p className="text-xs leading-5 text-muted">没有执行到你的代码{run.error ? "，程序在开始之前就出错了：" : "。"}</p>
        {run.error && <pre className="practice-output border-danger/30 bg-danger/5 text-danger">{run.error}</pre>}
      </div>
    );
  }

  const bp = new Set(breakpoints);
  const find = (from: number, dir: 1 | -1, ok: (i: number) => boolean, fallback: number) => {
    for (let i = from + dir; i >= 0 && i <= last; i += dir) if (ok(i)) return i;
    return fallback;
  };
  const depth = step.stack.length;
  const go = {
    first: () => onIndex(0),
    back: () => onIndex(Math.max(0, at - 1)),
    next: () => onIndex(Math.min(last, at + 1)),
    // 跳过：不进当前这一行里调用的函数，停在同一层或外层的下一步
    over: () => onIndex(find(at, 1, (i) => steps[i].stack.length <= depth, last)),
    // 跳出：跑完当前函数，停在外层
    out: () => onIndex(find(at, 1, (i) => steps[i].stack.length < depth, last)),
    // 继续：到下一个断点（没有断点就到最后）
    cont: () => onIndex(find(at, 1, (i) => steps[i].event === "line" && bp.has(steps[i].line), last)),
    backCont: () => onIndex(find(at, -1, (i) => steps[i].event === "line" && bp.has(steps[i].line), 0)),
  };
  const output = run.stdout.slice(0, step.out);
  const pin = (name: string) => onWatch(watch.includes(name) ? watch.filter((n) => n !== name) : [...watch, name]);
  const addWatch = (expr: string) => {
    if (!watch.includes(expr)) onWatch([...watch, expr]);
  };
  const toggle = (name: string) => setOpen((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const values = new Map(step.vars);
  // 钉住的排在最上面，按钉的先后；其余按记录里的顺序
  const rows = [...watch.filter((n) => values.has(n)).map((n) => [n, values.get(n)!] as [string, string]), ...step.vars.filter(([k]) => !watch.includes(k))];

  return (
    <div
      className="practice-debug outline-none"
      data-testid="practice-debugger"
      onKeyDown={(e) => {
        // 方向键前后走一步；F10 跳过、F11 进入、Shift+F11 跳出、F8 继续（和常见的调试器一样）
        const k = e.key;
        const act = k === "ArrowRight" || k === "F11" && !e.shiftKey ? go.next : k === "ArrowLeft" ? go.back : k === "F10" ? go.over : k === "F11" ? go.out : k === "F8" ? (e.shiftKey ? go.backCont : go.cont) : null;
        if (!act || (e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.preventDefault();
        act();
      }}
      tabIndex={0}
    >
      {modeToggle}
      <div className="practice-debug-bar" title="← → 前后走一步，F10 跳过，Shift+F11 跳出，F8 到下一个断点；点行号加断点">
        <Button aria-label="回到第一步" className="practice-tb-icon" isDisabled={at === 0} isIconOnly onPress={go.first} size="sm" variant="ghost"><StepIcon d="M3.5 3v10M13 3 6 8l7 5z" /></Button>
        <Button aria-label="上一个断点" className="practice-tb-icon" isDisabled={at === 0} isIconOnly onPress={go.backCont} size="sm" variant="ghost"><StepIcon d="M8 3 2.5 8 8 13zM14 3 8.5 8l5.5 5z" /></Button>
        <Button aria-label="上一步（←）" className="practice-tb-icon" isDisabled={at === 0} isIconOnly onPress={go.back} size="sm" variant="ghost"><StepIcon d="M10 3 4.5 8l5.5 5" /></Button>
        <Button aria-label="下一步（→ 或 F11，会进入函数）" className="practice-tb-icon practice-debug-next" isDisabled={at === last} isIconOnly onPress={go.next} size="sm" variant="secondary"><StepIcon d="m6 3 5.5 5L6 13" /></Button>
        <Button aria-label="跳过（F10，不进入这一行调用的函数）" className="practice-tb-icon" isDisabled={at === last} isIconOnly onPress={go.over} size="sm" variant="ghost"><StepIcon d="M2.5 10a5.5 5.5 0 0 1 10.5-2.5M13.5 4v3.5H10M7.5 12.5h1" /></Button>
        <Button aria-label="跳出（Shift+F11，跑完当前函数）" className="practice-tb-icon" isDisabled={at === last || depth <= 1} isIconOnly onPress={go.out} size="sm" variant="ghost"><StepIcon d="M8 13V4M4.5 7.5 8 4l3.5 3.5M3 2.5h10" /></Button>
        <Button aria-label={breakpoints.length ? "继续到下一个断点（F8）" : "继续到最后（F8）"} className="practice-tb-icon" isDisabled={at === last} isIconOnly onPress={go.cont} size="sm" variant="ghost"><StepIcon d="M2.5 3 8 8l-5.5 5zM8.5 3 14 8l-5.5 5z" /></Button>
        <input
          aria-label="调试进度"
          aria-valuetext={`第 ${at + 1} 步，共 ${steps.length} 步，第 ${step.line} 行`}
          className="practice-debug-range"
          max={last}
          min={0}
          onChange={(e) => onIndex(Number(e.target.value))}
          type="range"
          value={at}
        />
        <span className="practice-debug-pos">{at + 1}/{steps.length} · 行 {step.line}</span>
        {step.event === "return" && <span className="practice-debug-badge text-success">返回</span>}
        {step.event === "exception" && <span className="practice-debug-badge text-danger">异常</span>}
      </div>
      {(depth > 1 || stale || (run.trace?.truncated && at === last)) && (
        <div className="practice-debug-meta">
          {depth > 1 && <span className="min-w-0 truncate font-mono" title="调用栈：外层在前">{step.stack.map(([fn, line]) => `${fn}:${line}`).join(" › ")}</span>}
          {stale && <span className="text-warning">代码改过了，这还是改之前的记录</span>}
          {run.trace?.truncated && at === last && <span className="text-warning">只记了前 {run.trace.limit} 步</span>}
        </div>
      )}

      <WatchInputBar
        hint={canRecordWatchExpr ? "输入变量或表达式追踪（如 nums[i]、left + right）" : "输入变量名提前追踪（如 i、seen）"}
        onAdd={addWatch}
        suggestions={allVarNames}
        watch={watch}
      />

      {watch.length > 0 && (
        <div className="practice-watch" aria-label="追踪的变量">
          {history.map(({ name, points, recordedInWatch }) => {
            const cur = points.filter((p) => p.at <= at).pop();
            const needsRerun = !points.length && !recordedInWatch && isExpressionLike(name) && canRecordWatchExpr && onRerunDebug;
            return (
              <div className="practice-watch-row" key={name}>
                <button aria-label={`不再追踪 ${name}`} className="practice-pin is-on" onClick={() => pin(name)} title="不再追踪" type="button">★</button>
                <span className="practice-var-name" title={name}>{name}</span>
                <div className="practice-watch-points">
                  {points.length ? points.map((p) => (
                    <button className={clsx("practice-watch-point", p === cur && "is-current")} key={p.at} onClick={() => onIndex(p.at)} title={`第 ${p.at + 1} 步（第 ${steps[p.at].line} 行）：${p.value}`} type="button">{split(p.value).body}</button>
                  )) : needsRerun ? (
                    <span className="flex items-center gap-2 text-[11px] text-muted">
                      <span>该表达式尚未录制</span>
                      <button className="practice-watch-rerun" onClick={onRerunDebug} type="button">重新调试求值</button>
                    </span>
                  ) : <span className="text-[11px] text-muted">还没出现</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="practice-vars" role="list">
        {rows.length === 0 && <span className="px-2 py-1 text-muted">这一步还没有变量。</span>}
        {rows.map(([name, value]) => {
          const { tag, body } = split(value);
          const pinned = watch.includes(name);
          return (
            <div className={clsx("practice-var", changed.has(name) && "is-changed", open.has(name) && "is-open")} key={name} role="listitem">
              <button aria-label={pinned ? `不再追踪 ${name}` : `追踪 ${name}`} aria-pressed={pinned} className={clsx("practice-pin", pinned && "is-on")} onClick={() => pin(name)} title={pinned ? "不再追踪" : "追踪这个变量：看它每一步怎么变"} type="button">{pinned ? "★" : "☆"}</button>
              <span className="practice-var-name">{name}</span>
              <button className="practice-var-value" onClick={() => toggle(name)} title={open.has(name) ? "收起" : "点一下看完整的值"} type="button">
                {tag && <span className="practice-var-tag">{tag}</span>}{body}
              </button>
            </div>
          );
        })}
        {step.ret !== undefined && (
          <div className="practice-var is-ret" role="listitem"><span className="practice-pin" /><span className="practice-var-name text-success">返回值</span><span className="practice-var-value is-static text-success">{step.ret}</span></div>
        )}
        {step.exc && (
          <div className="practice-var is-open" role="listitem"><span className="practice-pin" /><span className="practice-var-name text-danger">异常</span><span className="practice-var-value is-static text-danger">{step.exc}</span></div>
        )}
      </div>
      {output && (
        <details className="practice-debug-output">
          <summary>到这一步为止的输出（{output.split("\n").filter(Boolean).length} 行）</summary>
          <pre className="practice-output">{output}</pre>
        </details>
      )}
      {at === last && run.error && !run.trace?.truncated && <pre className="practice-output border-danger/30 bg-danger/5 text-danger">{run.error}</pre>}
    </div>
  );
}

export function LiveDapDebugger({
  snap,
  breakpoints,
  stale,
  watch,
  onWatch,
  onContinue,
  onNext,
  onStepIn,
  onStepOut,
  onStop,
  onRestart,
  modeToggle,
}: {
  snap: DapSnapshot;
  breakpoints: number[];
  stale: boolean;
  watch: string[];
  onWatch: (names: string[]) => void;
  onContinue: () => void;
  onNext: () => void;
  onStepIn: () => void;
  onStepOut: () => void;
  onStop: () => void;
  onRestart: () => void;
  modeToggle?: ReactNode;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const paused = snap.status === "paused";
  const active = snap.status === "connecting" || snap.status === "running" || paused;
  const changedSet = useMemo(() => new Set(snap.changed), [snap.changed]);
  const varSuggestions = useMemo(() => snap.vars.map(([k]) => k), [snap.vars]);

  const pin = (name: string) => onWatch(watch.includes(name) ? watch.filter((n) => n !== name) : [...watch, name]);
  const addWatch = (expr: string) => {
    if (!watch.includes(expr)) onWatch([...watch, expr]);
  };
  const toggle = (name: string) => setOpen((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });

  const values = new Map(snap.vars);
  const rows = [...watch.filter((n) => values.has(n)).map((n) => [n, values.get(n)!] as [string, string]), ...snap.vars.filter(([k]) => !watch.includes(k))];

  const statusText = snap.status === "connecting"
    ? "正在启动云端调试器…"
    : snap.status === "running"
    ? "运行中…"
    : snap.status === "paused"
    ? `已暂停 · 行 ${snap.line ?? "?"}`
    : snap.status === "error"
    ? "调试出错"
    : "已结束";

  return (
    <div
      className="practice-debug outline-none"
      data-testid="practice-live-dap-debugger"
      onKeyDown={(e) => {
        if (!paused) return;
        const k = e.key;
        const act = k === "F10" ? onNext : k === "F11" && !e.shiftKey ? onStepIn : k === "F11" && e.shiftKey ? onStepOut : k === "F8" ? onContinue : null;
        if (!act || (e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.preventDefault();
        act();
      }}
      tabIndex={0}
    >
      {modeToggle}
      <div className="practice-debug-bar" title="F8 继续，F10 跳过，F11 进入，Shift+F11 跳出；支持暂停时实时求值任意表达式">
        <Button aria-label={breakpoints.length ? "继续到下一个断点（F8）" : "继续运行（F8）"} className="practice-tb-icon" isDisabled={!paused} isIconOnly onPress={onContinue} size="sm" variant="ghost"><StepIcon d="M2.5 3 8 8l-5.5 5zM8.5 3 14 8l-5.5 5z" /></Button>
        <Button aria-label="跳过（F10）" className="practice-tb-icon practice-debug-next" isDisabled={!paused} isIconOnly onPress={onNext} size="sm" variant="secondary"><StepIcon d="M2.5 10a5.5 5.5 0 0 1 10.5-2.5M13.5 4v3.5H10M7.5 12.5h1" /></Button>
        <Button aria-label="进入函数（F11）" className="practice-tb-icon" isDisabled={!paused} isIconOnly onPress={onStepIn} size="sm" variant="ghost"><StepIcon d="m6 3 5.5 5L6 13" /></Button>
        <Button aria-label="跳出函数（Shift+F11）" className="practice-tb-icon" isDisabled={!paused || snap.stack.length <= 1} isIconOnly onPress={onStepOut} size="sm" variant="ghost"><StepIcon d="M8 13V4M4.5 7.5 8 4l3.5 3.5M3 2.5h10" /></Button>
        {active ? (
          <Button className="practice-tb-btn ml-1" onPress={onStop} size="sm" variant="danger-soft">停止调试</Button>
        ) : (
          <Button className="practice-tb-btn ml-1" onPress={onRestart} size="sm" variant="secondary">重新调试</Button>
        )}
        <span className="flex-1" />
        <span className={clsx("practice-debug-live-badge", paused ? "text-accent" : snap.status === "error" ? "text-danger" : "text-muted")}>{statusText}</span>
      </div>

      {(snap.stack.length > 1 || stale) && (
        <div className="practice-debug-meta">
          {snap.stack.length > 1 && <span className="min-w-0 truncate font-mono" title="调用栈">{snap.stack.map(([fn, line]) => `${fn}:${line}`).join(" › ")}</span>}
          {stale && <span className="text-warning">代码改过了，当前还是改之前的调试会话</span>}
        </div>
      )}

      <WatchInputBar
        hint="输入表达式实时求值（如 nums[i]、left + right、ans.size()）"
        onAdd={addWatch}
        suggestions={varSuggestions}
        watch={watch}
      />

      {watch.length > 0 && (
        <div className="practice-watch" aria-label="实时追踪表达式">
          {snap.watches.map((entry) => {
            const { expr, value, error, history } = entry;
            return (
              <div className="practice-watch-row" key={expr}>
                <button aria-label={`不再追踪 ${expr}`} className="practice-pin is-on" onClick={() => pin(expr)} title="不再追踪" type="button">★</button>
                <span className="practice-var-name" title={expr}>{expr}</span>
                <div className="practice-watch-points">
                  {value !== undefined ? (
                    <span className="practice-watch-point is-current" title={value}>{split(value).body}</span>
                  ) : error ? (
                    <span className="text-[11px] text-danger" title={error}>{error}</span>
                  ) : (
                    <span className="text-[11px] text-muted">{paused ? "求值中…" : "暂停后求值"}</span>
                  )}
                  {history.slice(0, -1).slice(-8).map((h) => (
                    <span className="practice-watch-point" key={`${h.stop}-${h.line}`} title={`第 ${h.stop} 次暂停（第 ${h.line} 行）：${h.value}`}>
                      #{h.stop}:{split(h.value).body}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paused && (
        <div className="practice-vars" role="list">
          {rows.length === 0 && <span className="px-2 py-1 text-muted">当前作用域还没有局部变量。</span>}
          {rows.map(([name, value]) => {
            const { tag, body } = split(value);
            const pinned = watch.includes(name);
            return (
              <div className={clsx("practice-var", changedSet.has(name) && "is-changed", open.has(name) && "is-open")} key={name} role="listitem">
                <button aria-label={pinned ? `不再追踪 ${name}` : `追踪 ${name}`} aria-pressed={pinned} className={clsx("practice-pin", pinned && "is-on")} onClick={() => pin(name)} title={pinned ? "不再追踪" : "追踪这个变量或表达式"} type="button">{pinned ? "★" : "☆"}</button>
                <span className="practice-var-name">{name}</span>
                <button className="practice-var-value" onClick={() => toggle(name)} title={open.has(name) ? "收起" : "点一下看完整的值"} type="button">
                  {tag && <span className="practice-var-tag">{tag}</span>}{body}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {snap.stdout && (
        <details className="practice-debug-output" open={snap.status === "terminated"}>
          <summary>标准输出（{snap.stdout.split("\n").filter(Boolean).length} 行）</summary>
          <pre className="practice-output">{snap.stdout}</pre>
        </details>
      )}
      {snap.error && <pre className="practice-output border-danger/30 bg-danger/5 text-danger">{snap.error}</pre>}
    </div>
  );
}

function StepIcon({ d }: { d: string }) {
  return <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="14"><path d={d} /></svg>;
}
