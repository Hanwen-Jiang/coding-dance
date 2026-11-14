"use client";

import { Button, Card } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { renderViews } from "@/components/demo/render";
import { ChevronLeft, ChevronRight, PlayIcon } from "@/components/icons";
import { PixelIcon } from "@/components/pixel";
import type { Demo } from "@/lib/types";

type Step = { phase: string; msg: string; views: Record<string, unknown>[]; kind?: string; facts?: [string, unknown][] };
type BuildFn = (args: unknown, snap: (phase: string, msg: string, views: Step["views"], o?: Partial<Step>) => void) => void;

/** 把 spec 里的 build 方法（形如 "build(a, snap) { ... }"）变回函数。来源是自己仓库里的数据。 */
function compile(src: string): BuildFn | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return new Function(`return { ${src} }`)().build as BuildFn;
  } catch {
    return null;
  }
}

type Input = { args: unknown; note: string; label?: string };

/** 「随机」：数据里是一段自包含的函数源码，调用后返回 { args, note } */
function compileRandom(src: string | null | undefined): (() => Input) | null {
  if (!src) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return new Function(`return (${src})`)() as () => Input;
  } catch {
    return null;
  }
}

function runSteps(build: BuildFn, args: unknown): Step[] {
  const steps: Step[] = [];
  try {
    build(JSON.parse(JSON.stringify(args)), (phase, msg, views, o) => steps.push({ phase, msg, views, ...(o || {}) }));
  } catch (e) {
    steps.push({ phase: "出错了", msg: String(e), views: [], kind: "warn" });
  }
  return steps;
}

const PauseIcon = () => (
  <svg fill="currentColor" height={16} viewBox="0 0 16 16" width={16}>
    <rect height="10" rx="1" width="3" x="4" y="3" />
    <rect height="10" rx="1" width="3" x="9" y="3" />
  </svg>
);

export function DemoPlayer({ demo }: { demo: Demo }) {
  const build = useMemo(() => compile(demo.build), [demo.build]);
  const random = useMemo(() => compileRandom(demo.random), [demo.random]);
  // sel 是预设的下标，或者 "random"
  const [sel, setSel] = useState("0");
  const [rolled, setRolled] = useState<Input | null>(null);
  const input: Input | null = sel === "random" ? rolled : demo.presets[Number(sel)] ?? null;
  const steps = useMemo(() => (build && input ? runSteps(build, input.args) : []), [build, input]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const last = Math.max(0, steps.length - 1);
  const go = useCallback((i: number) => setIdx(Math.max(0, Math.min(last, i))), [last]);

  const reroll = () => {
    if (!random) return;
    try {
      setRolled(random());
      setSel("random");
    } catch {
      /* 随机输入生成失败就留在当前示例 */
    }
  };

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [input]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setIdx((i) => {
        if (i >= last) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1100);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, last]);

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (idx >= last) setIdx(0);
    setPlaying(true);
  };

  if (!build || !steps.length) return <p className="text-sm text-muted">这道题的演示加载失败了。</p>;
  const s = steps[Math.min(idx, last)];
  const html = renderViews(s.views);

  return (
    <div
      className="demo grid gap-5 outline-none lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          setPlaying(false);
          go(idx + 1);
        } else if (e.key === "ArrowLeft") {
          setPlaying(false);
          go(idx - 1);
        } else if (e.key === " ") {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      <Card className="min-w-0 gap-4 p-4 sm:p-5">
        {(demo.presets.length > 1 || random) && (
          <div className="flex flex-wrap items-center gap-2">
            <Segment
              aria-label="选择示例"
              className="max-w-full overflow-x-auto"
              selectedKey={sel}
              size="sm"
              onSelectionChange={(k) => (String(k) === "random" ? reroll() : setSel(String(k)))}
            >
              {demo.presets.map((p, i) => (
                <Segment.Item key={i} id={String(i)}>
                  {p.label}
                </Segment.Item>
              ))}
              {random ? (
                <Segment.Item key="random" id="random">
                  随机
                </Segment.Item>
              ) : null}
            </Segment>
            {sel === "random" && (
              <Button size="sm" variant="ghost" onPress={reroll}>
                <PixelIcon cell={2} name="dice" />
                换一组
              </Button>
            )}
          </div>
        )}
        {input?.note && (
          <div className="font-mono text-xs text-muted [overflow-wrap:anywhere]">
            {sel === "random" && <span className="font-pixel me-2 text-[10px] tracking-wider text-accent">RANDOM</span>}
            {input.note}
          </div>
        )}
        <div className="dm-views" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="flex flex-col gap-3 border-t border-separator pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onPress={() => { setPlaying(false); go(0); }}>
              重置
            </Button>
            <Button isDisabled={idx === 0} size="sm" variant="secondary" onPress={() => { setPlaying(false); go(idx - 1); }}>
              <ChevronLeft />
              上一步
            </Button>
            <Button isDisabled={idx >= last} size="sm" onPress={() => { setPlaying(false); go(idx + 1); }}>
              下一步
              <ChevronRight />
            </Button>
            <Button size="sm" variant="outline" onPress={togglePlay}>
              {playing ? <PauseIcon /> : <PlayIcon />}
              {playing ? "暂停" : "自动播放"}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <input
              aria-label="步骤"
              className="dm-range min-w-0 flex-1"
              max={last}
              min={0}
              type="range"
              value={idx}
              onChange={(e) => { setPlaying(false); go(Number(e.target.value)); }}
            />
            <span className="font-pixel w-16 text-right text-[11px] text-muted tabular-nums">
              {idx}/{last}
            </span>
          </div>
          {/* 像素进度条：每一步一个格子 */}
          {steps.length <= 120 && (
            <div aria-hidden className="flex flex-wrap gap-[3px]">
              {steps.map((st, i) => (
                <button
                  key={i}
                  className={clsx(
                    "size-[7px] rounded-[2px] transition-colors",
                    i === idx ? "bg-accent" : i < idx ? (st.kind === "warn" ? "bg-warning/60" : "bg-accent/35") : "bg-foreground/10",
                  )}
                  tabIndex={-1}
                  type="button"
                  onClick={() => { setPlaying(false); go(i); }}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        {s.facts && s.facts.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-3 border-b border-separator pb-4">
            {s.facts.map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted">{k}</span>
                <span className={clsx("font-bold text-accent [overflow-wrap:anywhere]", String(v).length > 6 ? "font-mono text-sm" : "text-2xl")}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}
        <span
          className={clsx(
            "font-pixel self-start rounded-md px-2.5 py-0.5 text-[11px] tracking-wider",
            s.kind === "ok" ? "bg-success/15 text-success" : s.kind === "warn" ? "bg-warning/15 text-warning" : "bg-accent/10 text-accent",
          )}
        >
          {s.phase}
        </span>
        <p key={`${sel}-${idx}`} className="dm-msg min-h-[5.5em] text-base leading-7" dangerouslySetInnerHTML={{ __html: s.msg }} />
        {demo.legend.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
            {demo.legend.map(([cls, t]) => (
              <span key={cls + t} className="inline-flex items-center gap-1.5">
                <i className={clsx("dm-sw", `r-${cls}`)} />
                {t}
              </span>
            ))}
          </div>
        )}
        <span className="hidden text-[11px] text-muted lg:block">点一下演示区域后，可以用 ← → 切换步骤，空格键播放 / 暂停。</span>
      </div>
    </div>
  );
}
