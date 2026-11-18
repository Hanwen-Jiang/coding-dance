"use client";

// 调试面板：在执行记录上前进、后退、跳过 / 跳出函数、跳到下一个断点。程序不会真的停下来（浏览器里做不到），
// 而是先完整跑一遍、记下每一步，再在记录上来回看，所以也能往回走。编辑器里当前行的高亮由 workbench 传给编辑器。
// 排得紧凑：一行图标按钮 + 进度条 + 第几步；变量一行一个（名字 | 值），值太长省略，点一下展开；
// 名字前的 ☆ 钉住追踪：钉住的变量排在最上面，列出它在哪几步变了、变成了什么，点一下跳到那一步。
import { Button } from "@heroui/react";
import clsx from "clsx";
import { useMemo, useState } from "react";

import type { PracticeTrace } from "@/lib/practice/types";

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
  const js = value.match(/^((?:Map|Set|[A-Z]\w*Array)\(\d+\)) ([\s\S]*)$/);
  if (js) return { tag: js[1].replace("(", "·").replace(")", ""), body: js[2] };
  const py = value.match(/^([A-Za-z_][\w.]*)\(([\s\S]*)\)$/);
  if (py && !/^(ListNode|TreeNode|Node)$/.test(py[1])) return { tag: py[1], body: py[2] };
  return { tag: "", body: value };
}

export function PracticeDebugger({ run, index, onIndex, breakpoints, stale, watch, onWatch }: {
  run: DebugRun;
  index: number;
  onIndex: (index: number) => void;
  breakpoints: number[];
  stale: boolean;
  /** 钉住追踪的变量名 */
  watch: string[];
  onWatch: (names: string[]) => void;
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
  // 追踪：钉住的变量在哪几步变了（第一次出现也算），最多列 200 个点
  const history = useMemo(() => watch.map((name) => {
    const points: { at: number; value: string }[] = [];
    let before: string | undefined;
    steps.forEach((s, i) => {
      const v = s.vars.find(([k]) => k === name)?.[1];
      if (v !== undefined && v !== before && points.length < 200) points.push({ at: i, value: v });
      before = v;
    });
    return { name, points };
  }), [watch, steps]);

  if (run.cancelled) return <p className="py-4 text-center text-xs text-muted">调试已停止。</p>;
  if (!step) {
    return (
      <div className="flex flex-col gap-2">
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
        if (!act || (e.target as HTMLElement).tagName === "INPUT") return;
        e.preventDefault();
        act();
      }}
      tabIndex={0}
    >
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

      {history.some((h) => h.points.length) && (
        <div className="practice-watch" aria-label="追踪的变量">
          {history.map(({ name, points }) => {
            const cur = points.filter((p) => p.at <= at).pop();
            return (
              <div className="practice-watch-row" key={name}>
                <button aria-label={`不再追踪 ${name}`} className="practice-pin is-on" onClick={() => pin(name)} title="不再追踪" type="button">★</button>
                <span className="practice-var-name">{name}</span>
                <div className="practice-watch-points">
                  {points.length ? points.map((p) => (
                    <button className={clsx("practice-watch-point", p === cur && "is-current")} key={p.at} onClick={() => onIndex(p.at)} title={`第 ${p.at + 1} 步（第 ${steps[p.at].line} 行）：${p.value}`} type="button">{split(p.value).body}</button>
                  )) : <span className="text-muted">还没出现</span>}
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

function StepIcon({ d }: { d: string }) {
  return <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="14"><path d={d} /></svg>;
}
