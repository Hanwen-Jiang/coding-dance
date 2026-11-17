"use client";

// 调试面板：在执行记录上前进、后退、跳过 / 跳出函数、跳到下一个断点。程序不会真的停下来（浏览器里做不到），
// 而是先完整跑一遍、记下每一步，再在记录上来回看，所以也能往回走。编辑器里当前行的高亮由 workbench 传给编辑器。
import { Button } from "@heroui/react";
import clsx from "clsx";
import { useMemo } from "react";

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

export function PracticeDebugger({ run, index, onIndex, breakpoints, stale }: {
  run: DebugRun;
  index: number;
  onIndex: (index: number) => void;
  breakpoints: number[];
  stale: boolean;
}) {
  const steps = run.trace?.steps ?? [];
  const last = steps.length - 1;
  const at = Math.min(Math.max(index, 0), Math.max(last, 0));
  const step = steps[at];
  const prev = at > 0 ? steps[at - 1] : undefined;
  const changed = useMemo(() => {
    const before = new Map(prev?.vars ?? []);
    return new Set((step?.vars ?? []).filter(([k, v]) => prev && before.get(k) !== v).map(([k]) => k));
  }, [step, prev]);

  if (run.cancelled) return <p className="py-5 text-center text-xs text-muted">调试已停止。</p>;
  if (!step) {
    return (
      <div className="flex flex-col gap-3">
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

  return (
    <div
      className="flex flex-col gap-3 outline-none"
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
      <div className="flex flex-wrap items-center gap-1">
        <Button aria-label="回到第一步" isDisabled={at === 0} isIconOnly onPress={go.first} size="sm" variant="ghost"><StepIcon d="M3.5 3v10M13 3 6 8l7 5z" /></Button>
        <Button aria-label="上一个断点" isDisabled={at === 0} isIconOnly onPress={go.backCont} size="sm" variant="ghost"><StepIcon d="M8 3 2.5 8 8 13zM14 3 8.5 8l5.5 5z" /></Button>
        <Button aria-label="上一步（←）" isDisabled={at === 0} onPress={go.back} size="sm" variant="ghost"><StepIcon d="M10 3 4.5 8l5.5 5" />上一步</Button>
        <Button aria-label="下一步（→ 或 F11，会进入函数）" isDisabled={at === last} onPress={go.next} size="sm" variant="outline">下一步<StepIcon d="m6 3 5.5 5L6 13" /></Button>
        <Button aria-label="跳过（F10，不进入这一行调用的函数）" isDisabled={at === last} onPress={go.over} size="sm" variant="ghost">跳过</Button>
        <Button aria-label="跳出（Shift+F11，跑完当前函数）" isDisabled={at === last || depth <= 1} onPress={go.out} size="sm" variant="ghost">跳出</Button>
        <Button aria-label={breakpoints.length ? "继续到下一个断点（F8）" : "继续到最后（F8）"} isDisabled={at === last} onPress={go.cont} size="sm" variant="ghost">{breakpoints.length ? "下一个断点" : "到最后"}<StepIcon d="M2.5 3 8 8l-5.5 5zM8.5 3 14 8l-5.5 5z" /></Button>
      </div>
      <input
        aria-label="调试进度"
        aria-valuetext={`第 ${at + 1} 步，共 ${steps.length} 步，第 ${step.line} 行`}
        className="practice-debug-range w-full"
        max={last}
        min={0}
        onChange={(e) => onIndex(Number(e.target.value))}
        type="range"
        value={at}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-mono text-muted">第 {at + 1} / {steps.length} 步</span>
        <span className="font-semibold">第 {step.line} 行</span>
        {step.event === "return" && <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">返回</span>}
        {step.event === "exception" && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">抛出异常</span>}
        <span className="min-w-0 truncate font-mono text-muted" title="调用栈：外层在前">{step.stack.map(([fn, line]) => `${fn}:${line}`).join(" › ") || step.fn}</span>
      </div>
      {stale && <p className="text-xs text-warning">代码改过了，下面还是改之前的执行记录。重新点「调试」看新的。</p>}
      {run.trace?.truncated && at === last && <p className="text-xs text-warning">只记录了前 {run.trace.limit} 步，程序在这里停下了。可以换一组小一点的输入。</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[minmax(80px,auto)_minmax(0,1fr)] text-xs">
          {step.vars.length === 0 && <span className="col-span-2 px-3 py-2 text-muted">这一步还没有变量。</span>}
          {step.vars.map(([name, value]) => (
            <div className={clsx("contents", changed.has(name) && "practice-debug-changed")} key={name}>
              <span className="border-b border-separator px-3 py-1.5 font-mono text-muted">{name}</span>
              <span className={clsx("practice-debug-value border-b border-separator px-3 py-1.5 font-mono", changed.has(name) && "text-accent")} title={changed.has(name) ? "这一步变了" : undefined}>{value}</span>
            </div>
          ))}
          {step.ret !== undefined && (
            <>
              <span className="px-3 py-1.5 font-mono text-success">返回值</span>
              <span className="practice-debug-value px-3 py-1.5 font-mono text-success">{step.ret}</span>
            </>
          )}
          {step.exc && (
            <>
              <span className="px-3 py-1.5 font-mono text-danger">异常</span>
              <span className="practice-debug-value px-3 py-1.5 font-mono text-danger">{step.exc}</span>
            </>
          )}
        </div>
      </div>
      {output && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-muted">到这一步为止的输出</span>
          <pre className="practice-output">{output}</pre>
        </div>
      )}
      {at === last && run.error && !run.trace?.truncated && <pre className="practice-output border-danger/30 bg-danger/5 text-danger">{run.error}</pre>}
      <p className="text-[11px] leading-5 text-muted">
        用的是「{run.label}」。点行号左边的空白处加断点{breakpoints.length ? `（现在 ${breakpoints.length} 个）` : ""}；方向键前后走，F10 跳过，Shift+F11 跳出，F8 到下一个断点。这一步变了的变量会高亮。
      </p>
    </div>
  );
}

function StepIcon({ d }: { d: string }) {
  return <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="14"><path d={d} /></svg>;
}
