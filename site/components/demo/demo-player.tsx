"use client";

import { Button, Card, Tabs } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { renderViews } from "@/components/demo/render";
import { StepCode } from "@/components/demo/step-code";
import { ChevronLeft, ChevronRight, EyeIcon, PlayIcon } from "@/components/icons";
import { LangTabs } from "@/components/lang-picker";
import { PixelIcon } from "@/components/pixel";
import { codeIn, langLabel } from "@/lib/langs";
import { usePrefs } from "@/lib/prefs";
import type { Demo, DemoMethod, SpecCode } from "@/lib/types";

/** at：这一步对应代码里的哪些标记（tag），播放器按它高亮代码行 */
type Step = { phase: string; msg: string; views: Record<string, unknown>[]; kind?: string; facts?: [string, unknown][]; at?: string | string[] };
const hasMarks = (m?: Record<string, number[]>) => !!m && Object.keys(m).length > 0;
const SHOW_CODE_KEY = "hot100:demo-code";
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

/**
 * codes：这道题（或专题这一节）的所有代码；演示的每种解法用 method.code 指到其中一段。
 * codeRevealed：题目页上题解还没点开时是 false，这一步的代码也盖上遮罩（看得到高亮在哪几行，看不清代码）；
 * onRevealCode 点开它，题解区也一起点开。不传就是直接显示（专题页没有剧透的问题）。
 */
export function DemoPlayer({ demo, codes = [], codeRevealed = true, onRevealCode }: { demo: Demo; codes?: SpecCode[]; codeRevealed?: boolean; onRevealCode?: () => void }) {
  // 多种解法共用同一组输入，切换解法时输入不变、从第 0 步重新播放
  const methods: DemoMethod[] = demo.methods?.length ? demo.methods : [{ t: "", note: null, legend: demo.legend, build: demo.build }];
  const [mi, setMi] = useState(0);
  const method = methods[Math.min(mi, methods.length - 1)];

  // 这种解法对应的代码：只在代码带步骤标记时显示。语言按用户的常用语言来，只列带标记的那些
  const { langs: prefLangs } = usePrefs();
  const entry = method.code ? codes.find((c) => c.key === method.code) : undefined;
  const codeLangs = useMemo(() => {
    if (!entry || !hasMarks(entry.marks)) return [];
    const mine = prefLangs.filter((l) => hasMarks(codeIn(entry, l)?.marks));
    return mine.length ? mine : ["python"];
  }, [entry, prefLangs]);
  const [picked, setPicked] = useState<string | null>(null);
  const lang = picked && codeLangs.includes(picked) ? picked : codeLangs[0];
  const text = entry && lang ? codeIn(entry, lang) : null;
  const [showCode, setShowCode] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem(SHOW_CODE_KEY) === "0") setShowCode(false); } catch { /* 读不了就默认显示 */ }
  }, []);
  const toggleCode = () => {
    setShowCode((v) => {
      try { localStorage.setItem(SHOW_CODE_KEY, v ? "0" : "1"); } catch { /* 存不了就只在这次访问里生效 */ }
      return !v;
    });
  };
  const build = useMemo(() => compile(method.build), [method.build]);
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
  }, [input, build]);

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

  // 每一步的图是 render.ts 拼的一段 HTML，宽的数组、树、表格放在 .dm-scroll 里横着滚。整段换掉会把滚动条打回开头，
  // 一张图一屏放不下时每点一次「下一步」都要重新滚过去。所以自己写 innerHTML：同一组输入、同一种解法里换步骤时，
  // 先记下每个 .dm-scroll 滚到哪，换完再滚回去；换了输入或解法才从头开始。
  // 每次渲染都检查一遍：容器被重新挂载（比如收起代码面板时布局变了）时 HTML 没变也要重新写进去。
  const viewsHtml = steps.length ? renderViews(steps[Math.min(idx, last)].views) : "";
  const viewsRef = useRef<HTMLDivElement>(null);
  const shown = useRef<{ el: HTMLElement | null; html: string; steps: Step[] | null }>({ el: null, html: "", steps: null });
  useLayoutEffect(() => {
    const el = viewsRef.current;
    const prev = shown.current;
    if (!el || (prev.el === el && prev.html === viewsHtml)) return;
    const keep = prev.el === el && prev.steps === steps ? [...el.querySelectorAll<HTMLElement>(".dm-scroll")].map((x) => [x.scrollLeft, x.scrollTop]) : [];
    el.innerHTML = viewsHtml;
    el.querySelectorAll<HTMLElement>(".dm-scroll").forEach((x, i) => {
      if (!keep[i]) return;
      x.scrollLeft = keep[i][0];
      x.scrollTop = keep[i][1];
    });
    shown.current = { el, html: viewsHtml, steps };
  });

  if (!build || !steps.length) return <p className="text-sm text-muted">这道题的演示加载失败了。</p>;
  const s = steps[Math.min(idx, last)];
  // 这一步对应的代码行：at 里的每个标记在当前语言里标了哪些行
  const active = text ? (s.at == null ? [] : [s.at].flat()).flatMap((t) => text.marks?.[t] ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      {methods.length > 1 && (
        <div className="flex flex-col gap-2">
          <Tabs className="w-full" selectedKey={String(mi)} onSelectionChange={(k) => setMi(Number(k))}>
            <Tabs.ListContainer className="max-w-full overflow-x-auto">
              <Tabs.List aria-label="选择解法">
                {methods.map((m, i) => (
                  <Tabs.Tab key={i} id={String(i)}>
                    {m.t}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          {method.note && <p className="hint-text text-sm leading-6 text-muted" dangerouslySetInnerHTML={{ __html: method.note }} />}
        </div>
      )}
      <div
        className={clsx("demo grid gap-5 outline-none", text && showCode ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]")}
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
          <div ref={viewsRef} className="dm-views" />
          <div className="flex flex-col gap-3 border-t border-separator pt-4">
            {/* 一行放下：手机上和桌面窄的演示栏里，「自动播放」带字会被挤到第二行，所以只留图标（读屏和悬停提示里有文字） */}
            <div className="flex flex-nowrap items-center gap-2">
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
              <Button isIconOnly aria-label={playing ? "暂停" : "自动播放"} className="ms-auto shrink-0" size="sm" variant="outline" onPress={togglePlay}>
                {playing ? <PauseIcon /> : <PlayIcon />}
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
          <p key={`${sel}-${mi}-${idx}`} className="dm-msg min-h-[5.5em] text-base leading-7" dangerouslySetInnerHTML={{ __html: s.msg }} />
          {text && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  aria-expanded={showCode}
                  className="font-pixel inline-flex items-center gap-1.5 rounded-md text-[11px] tracking-wider text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
                  type="button"
                  onClick={toggleCode}
                >
                  <span aria-hidden className={clsx("inline-block transition-transform", showCode ? "rotate-90" : "")}>▸</span>
                  这一步的代码{codeLangs.length < 2 && ` · ${langLabel(lang)}`}
                </button>
                {showCode && <LangTabs label="代码的语言" langs={codeLangs} value={lang} onChange={setPicked} />}
              </div>
              {showCode &&
                (codeRevealed ? (
                  <StepCode active={active} code={text.code} lang={lang} />
                ) : (
                  <div className="relative overflow-hidden rounded-2xl">
                    <div aria-hidden className="pointer-events-none select-none blur-[5px]">
                      <StepCode active={active} code={text.code} lang={lang} />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/30">
                      <span className="font-pixel text-[11px] tracking-widest text-muted">SPOILER</span>
                      <Button size="sm" onPress={onRevealCode}>
                        <EyeIcon />
                        查看代码
                      </Button>
                      <span className="text-xs text-muted">和下面的题解一起显示</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
          {method.legend.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
              {method.legend.map(([cls, t]) => (
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
    </div>
  );
}
