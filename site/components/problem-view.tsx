"use client";

import { Accordion, Breadcrumbs, Button, Card, Tabs } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import clsx from "clsx";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CodePanel } from "@/components/code-panel";
import { PracticeProvider, PracticeStatement, prefetchPractice } from "@/components/practice/context";
import { PracticeWorkbench } from "@/components/practice/workbench";
import { DemoPlayer } from "@/components/demo/demo-player";
import { AlertIcon, BulbIcon, ChevronDown, ChevronLeft, ChevronRight, CodeIcon, ExternalIcon, EyeIcon, HistoryIcon, PlayIcon } from "@/components/icons";
import { StatusPicker } from "@/components/account";
import { LevelPixels, PixelBullet, PixelIcon, PixelLoader, PixelText, Skel } from "@/components/pixel";
import { SolutionCode } from "@/components/solution-code";
import { TierChip, TopicChip } from "@/components/tags";
import { codeIn } from "@/lib/langs";
import { useCodingLayout } from "@/lib/practice/dock";
import { PRACTICE_SAVED_EVENT } from "@/lib/practice/save-queue";
import { usePrefs } from "@/lib/prefs";
import { useProgress } from "@/lib/progress";
import type { Attempt, AttemptResult, HistoryFile, ProblemDetail, Spec } from "@/lib/types";
import { TIER_INFO, TOPIC_KIND } from "@/lib/types";
import { fetchApi, useApi } from "@/lib/use-api";

type NavDir = "prev" | "next";
type ProblemNav = { go: (to: number, dir: NavDir) => void; link: (to: number, dir: NavDir) => Pick<React.ComponentProps<typeof NextLink>, "onClick" | "onFocus" | "onPointerEnter"> };
/** 上一页换题时往哪边走：新的一页挂上时读一次，用来决定从哪边滑进来（浏览器前进后退、别的链接进来的没有方向，照旧淡入） */
let enterFrom: NavDir | null = null;
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
/** 提前读好一道题：题目数据和练习数据都进内存，换过去时直接出来，不用看骨架 */
function prefetchProblem(id: number) {
  fetchApi(`/api/problem/${id}`).catch(() => { /* 真打开时再报错 */ });
  prefetchPractice(id);
}

/**
 * 上一题、下一题（面包屑旁边的按钮、快捷键 [ ]、页面最下面的两张卡片）：
 * 这一页先往反方向滑走、淡出（practice.css 的 data-leaving），同时把下一题的数据读好，最多等 0.4 秒再换页，
 * 读好了新的一页直接从前进的方向滑进来；没读好就照常先出骨架。鼠标移到链接上、键盘聚焦时就开始读，页面闲下来也会把前后两题读好。
 */
function useProblemNav(d: ProblemDetail | null): ProblemNav & { leaving: NavDir | null } {
  const router = useRouter();
  const [leaving, setLeaving] = useState<NavDir | null>(null);
  const busy = useRef(false);
  const id = d?.summary.id;
  useEffect(() => { setLeaving(null); busy.current = false; }, [id]);
  // 万一换页没成功（比如网络断了），别让这一页一直是透明的
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => { setLeaving(null); busy.current = false; }, 4000);
    return () => window.clearTimeout(t);
  }, [leaving]);
  const prevId = d?.prev?.id, nextId = d?.next?.id;
  useEffect(() => {
    if (!id) return;
    const run = () => { for (const to of [nextId, prevId]) if (to) { prefetchProblem(to); router.prefetch(`/p/${to}/`); } };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    const t = window.setTimeout(() => { if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2000 }); else run(); }, 1200);
    return () => window.clearTimeout(t);
  }, [id, prevId, nextId, router]);
  const go = useCallback((to: number, dir: NavDir) => {
    if (busy.current) return; // 已经在换了，连按不再排一次
    busy.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    enterFrom = dir;
    setLeaving(dir);
    const data = Promise.race([fetchApi(`/api/problem/${to}`).catch(() => undefined), sleep(400)]);
    void Promise.all([data, sleep(reduced ? 0 : 160)]).then(() => router.push(`/p/${to}/`));
  }, [router]);
  const link = useCallback<ProblemNav["link"]>((to, dir) => ({
    onClick: (e) => {
      // 新标签页、新窗口打开的照浏览器的来
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(to, dir);
    },
    onFocus: () => prefetchProblem(to),
    onPointerEnter: () => prefetchProblem(to),
  }), [go]);
  return { go, link, leaving };
}

/**
 * 面包屑那一行右边的「‹ 上一题 · 12 / 100 · 下一题 ›」（按重要程度），不占新的一行。
 * 快捷键 [ 和 ]；光标在编辑器、输入框里时不管。手机上只留箭头。页面最下面的两张卡片照旧留着。
 */
function ProblemPager({ d, nav }: { d: ProblemDetail; nav: ProblemNav }) {
  const { prev, next } = d;
  const { go, link } = nav;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || (e.key !== "[" && e.key !== "]")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.closest("input, textarea, select, [contenteditable], .cm-editor, [role=dialog]"))) return;
      const to = e.key === "[" ? prev : next;
      if (!to) return;
      e.preventDefault();
      if (!e.repeat) go(to.id, e.key === "[" ? "prev" : "next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, go]);
  const btn = "inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted no-underline outline-none transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <nav aria-label="按重要程度的上一题、下一题" className="flex shrink-0 items-center gap-0.5" data-testid="problem-pager">
      {prev ? (
        <NextLink aria-label={`上一题：${prev.id}. ${prev.name}（快捷键 [）`} className={btn} href={`/p/${prev.id}/`} title={`${prev.id}. ${prev.name}（[）`} {...link(prev.id, "prev")}>
          <ChevronLeft height={14} width={14} />
          <span className="max-sm:hidden">上一题</span>
        </NextLink>
      ) : <span aria-hidden className={clsx(btn, "pointer-events-none opacity-40")}><ChevronLeft height={14} width={14} /><span className="max-sm:hidden">上一题</span></span>}
      <span className="px-1 font-mono text-[11px] tabular-nums text-muted" title="在 100 题里按重要程度排第几">{d.summary.order} / 100</span>
      {next ? (
        <NextLink aria-label={`下一题：${next.id}. ${next.name}（快捷键 ]）`} className={btn} href={`/p/${next.id}/`} title={`${next.id}. ${next.name}（]）`} {...link(next.id, "next")}>
          <span className="max-sm:hidden">下一题</span>
          <ChevronRight height={14} width={14} />
        </NextLink>
      ) : <span aria-hidden className={clsx(btn, "pointer-events-none opacity-40")}><span className="max-sm:hidden">下一题</span><ChevronRight height={14} width={14} /></span>}
    </nav>
  );
}

const SECTIONS = [
  { id: "statement", label: "题目描述", en: "PROBLEM" },
  { id: "hints", label: "分层提示", en: "HINTS" },
  { id: "demo", label: "动画演示", en: "DEMO" },
  { id: "solution", label: "题解", en: "SOLUTION" },
  { id: "history", label: "我的历史题解", en: "MY CODE" },
  { id: "attempts", label: "尝试记录", en: "ATTEMPTS" },
  { id: "points", label: "写代码时注意", en: "NOTES" },
];

function SectionTitle({ id, children, extra }: { id: string; children: React.ReactNode; extra?: React.ReactNode }) {
  const s = SECTIONS.find((x) => x.id === id)!;
  const n = SECTIONS.findIndex((x) => x.id === id) + 1;
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="flex items-center gap-3 text-lg font-bold" id={id}>
        <PixelBullet />
        {children}
        <span className="font-pixel text-[10px] font-normal tracking-widest text-muted">
          0{n} · {s.en}
        </span>
      </h2>
      {extra}
    </div>
  );
}

function Hints({ spec }: { spec: Spec }) {
  return (
    <Accordion allowsMultipleExpanded className="w-full" variant="surface">
      {spec.hints.map((h, i) => (
        <Accordion.Item key={i} id={`hint-${i}`}>
          <Accordion.Heading>
            <Accordion.Trigger>
              <span className="me-3 shrink-0 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">提示 {i + 1}</span>
              <span className="text-left">{h.t}</span>
              <Accordion.Indicator>
                <ChevronDown />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div className="hint-text flex flex-col gap-2 text-[15px] leading-7 text-muted">
                {h.body.map((p, k) => (
                  <p key={k} dangerouslySetInnerHTML={{ __html: p }} />
                ))}
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

/** revealed 由题目页统一管：点开题解或者点开演示旁边的代码，两处一起显示 */
function Solutions({ spec, revealed, onReveal }: { spec: Spec; revealed: boolean; onReveal: () => void }) {
  const { langs: prefs } = usePrefs();
  const [tab, setTab] = useState<string | null>(null);
  const elegantIdx = spec.codes.findIndex((c) => c.kind === "elegant");
  const same = elegantIdx === 0;
  const all = [
    ...(elegantIdx >= 0 ? [{ id: "elegant", label: same ? "简洁 · 标准" : "优雅简洁", code: spec.codes[elegantIdx] }] : []),
    ...(!same ? [{ id: "standard", label: "标准题解", code: spec.codes[0] }] : []),
    ...spec.codes
      .map((c, i) => ({ c, i }))
      .filter(({ i }) => i !== 0 && i !== elegantIdx)
      .map(({ c, i }) => ({ id: `alt-${i}`, label: c.t.split("：")[0] || "其他写法", code: c })),
  ];
  // 有用户默认语言的写法排在前面：比如默认 Java 时，先显示有 Java 版本的标准题解，而不是只有 Python 的简洁写法
  const mine = (t: (typeof all)[number]) => (codeIn(t.code, prefs[0]) ? 0 : 1);
  const tabs = all.slice().sort((a, b) => mine(a) - mine(b));
  const current = tab && tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;

  if (!revealed) {
    return (
      <Card className="relative items-center gap-4 overflow-hidden px-6 py-10 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 blur-[6px]">
          <pre className="whitespace-pre p-6 text-left font-mono text-xs leading-6 text-muted">{tabs[0]?.code.code}</pre>
        </div>
        <div className="relative flex flex-col items-center gap-3">
          <span className="font-pixel text-[11px] tracking-widest text-muted">SPOILER</span>
          <Button onPress={onReveal}>
            <EyeIcon />
            查看题解
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-2 p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-accent">思路</div>
        <div className="text-base font-semibold">{spec.h1}</div>
        <p className="text-[15px] leading-7 text-muted">{spec.lede}</p>
      </Card>
      <Tabs className="w-full" selectedKey={current} onSelectionChange={(k) => setTab(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="题解写法">
            {tabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id}>
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {tabs.map((t) => (
          <Tabs.Panel key={t.id} className="flex flex-col gap-3 pt-4" id={t.id}>
            <div className="flex flex-col gap-1">
              <div className="font-semibold">{t.code.t}</div>
              {same && t.id === "elegant" && <p className="text-sm text-muted">标准解法本身已经足够简洁，两者是同一份代码。</p>}
              {t.code.note && <p className="hint-text text-sm leading-6 text-muted" dangerouslySetInnerHTML={{ __html: t.code.note }} />}
            </div>
            <SolutionCode code={t.code} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}

function HistoryEmpty({ title, desc, action }: { title: string; desc: React.ReactNode; action?: React.ReactNode }) {
  return (
    <EmptyState className="rounded-3xl border border-dashed border-border" size="sm">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <HistoryIcon />
        </EmptyState.Media>
        <EmptyState.Title>{title}</EmptyState.Title>
        <EmptyState.Description>{desc}</EmptyState.Description>
      </EmptyState.Header>
      {action && <EmptyState.Content>{action}</EmptyState.Content>}
    </EmptyState>
  );
}

type MineState = { key: string; history: HistoryFile[] | null; attempts: Attempt[] | null; error: string | null };

/** 从当前用户自己的进度仓读这道题的题解和尝试记录，两节共用一次请求 */
function useMine(id: number) {
  const { loading, session, loginHref } = useProgress();
  const user = session?.user?.login;
  const canRead = !!user && !!session?.repo?.exists && !!session.repo.accessible;
  const [state, setState] = useState<MineState>({ key: "", history: null, attempts: null, error: null });
  const key = canRead ? `${user}/${id}` : "";

  // 练习区把这道题的尝试记录、题解写进进度仓后，重新读一次
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onSaved = (e: Event) => { if ((e as CustomEvent<{ id: number }>).detail?.id === id) setVersion((v) => v + 1); };
    window.addEventListener(PRACTICE_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(PRACTICE_SAVED_EVENT, onSaved);
  }, [id]);

  useEffect(() => {
    if (!canRead) return;
    let alive = true;
    fetch(`/api/solutions/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `请求失败（${r.status}）`);
        return j as { history: HistoryFile[]; attempts?: Attempt[] };
      })
      .then((j) => alive && setState({ key, history: j.history ?? [], attempts: j.attempts ?? [], error: null }))
      .catch((e: Error) => alive && setState({ key, history: null, attempts: null, error: e.message }));
    return () => {
      alive = false;
    };
  }, [canRead, id, key, version]);

  return { loading, session, loginHref, id, state, ready: state.key === key && !!key };
}
type Mine = ReturnType<typeof useMine>;

/** 没登录、没开通、读取中、出错时两节共用的占位；返回 null 表示数据可用 */
function MineGate({ mine, what }: { mine: Mine; what: string }) {
  const { loading, session, loginHref, state, ready } = mine;
  if (loading) return <Skel className="h-24 w-full rounded-3xl" />;
  if (!session?.user) {
    return (
      <HistoryEmpty
        action={
          session?.configured ? (
            <a className="no-underline" href={loginHref()}>
              <Button size="sm" variant="outline">
                <PixelIcon cell={1.75} name="cat" />
                GitHub 登录
              </Button>
            </a>
          ) : undefined
        }
        desc={`登录 GitHub 后，这里显示你自己的进度仓里这道题的${what}。`}
        title={`登录后显示你的${what}`}
      />
    );
  }
  if (!session.repo?.exists || !session.repo.accessible) {
    return <HistoryEmpty desc={`先在首页按两步开通你的进度仓（创建仓库、授权），之后存进去的${what}会出现在这里。`} title="还没开通进度仓" />;
  }
  if (!ready) return <Skel className="h-24 w-full rounded-3xl" />;
  if (state.error) return <HistoryEmpty desc={state.error} title={`没能读到你的${what}`} />;
  return null;
}

/** 我的历史题解：solutions/ 里整理好的写法 */
function History({ d, mine }: { d: ProblemDetail; mine: Mine }) {
  const gate = MineGate({ mine, what: "题解" });
  if (gate) return gate;
  const { id, session, state } = mine;
  const history = state.history ?? [];
  if (!history.length) {
    return (
      <HistoryEmpty
        desc={
          <>
            在 <span className="font-mono">{session!.repo!.name}</span> 里按 <span className="font-mono">solutions/&lt;语言&gt;/{String(id).padStart(4, "0")}.{d.summary.name}.&lt;后缀&gt;</span> 存一份代码，这里会自动出现。
          </>
        }
        title="这道题还没有你的提交"
      />
    );
  }
  // 默认折叠：每份题解一行（写法 + 文件名），点开才显示代码
  return (
    <Accordion allowsMultipleExpanded className="w-full" variant="surface">
      {history.map((h) => (
        <Accordion.Item key={h.file} id={h.file}>
          <Accordion.Heading>
            <Accordion.Trigger>
              <span className="me-3 shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">{h.label}</span>
              <span className="min-w-0 flex-1 truncate text-left font-mono text-xs text-muted">{h.file}</span>
              <Accordion.Indicator>
                <ChevronDown />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <CodePanel code={h.code} label={h.label} lang={h.lang} />
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

const RESULT_STYLE: Record<AttemptResult, { dot: string; chip: string }> = {
  通过: { dot: "bg-success", chip: "bg-success/15 text-success" },
  答案错误: { dot: "bg-danger", chip: "bg-danger/15 text-danger" },
  超时: { dot: "bg-warning", chip: "bg-warning/15 text-warning" },
  运行出错: { dot: "bg-danger", chip: "bg-danger/15 text-danger" },
  思路不成立: { dot: "bg-foreground/40", chip: "bg-foreground/10 text-foreground" },
};
const LANG_NAME: Record<string, string> = {
  python: "Python", java: "Java", go: "Go", cpp: "C++", c: "C", javascript: "JavaScript", typescript: "TypeScript",
  rust: "Rust", kotlin: "Kotlin", swift: "Swift", csharp: "C#",
};

/** 尝试记录：attempts/ 里每一次提交，按时间排成一条线 */
function Attempts({ d, mine }: { d: ProblemDetail; mine: Mine }) {
  const gate = MineGate({ mine, what: "尝试记录" });
  if (gate) return gate;
  const { id, session, state } = mine;
  const attempts = state.attempts ?? [];
  if (!attempts.length) {
    return (
      <HistoryEmpty
        desc={
          <>
            每次提交（包括没通过的）在 <span className="font-mono">{session!.repo!.name}</span> 里按{" "}
            <span className="font-mono">attempts/{String(id).padStart(4, "0")}.{d.summary.name}/&lt;日期&gt;.&lt;序号&gt;.&lt;结果&gt;.md</span> 记一份，这里会按时间排出来。格式见进度仓 README。
            也可以用 <NextLink href="/sync/">「同步力扣」书签</NextLink> 把力扣上的提交记录直接导进来。
          </>
        }
        title="这道题还没有尝试记录"
      />
    );
  }
  return <AttemptList attempts={attempts} slug={d.slug} />;
}

/** 一次尝试点开后的内容：笔记、代码、文件路径 */
function AttemptBody({ a }: { a: Attempt }) {
  const sections = a.sections.map((sec) => ({ ...sec, text: a.submission ? sec.text.replace(/^https:\/\/leetcode\.cn\/\S+$/gm, "").trim() : sec.text })).filter((sec) => sec.text);
  return (
    <div className="flex flex-col gap-3">
      {sections.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.03] p-4">
          {sections.map((sec) => (
            <div key={sec.title} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">{sec.title}</span>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{sec.text}</p>
            </div>
          ))}
        </div>
      )}
      {a.code != null && <CodePanel code={a.code} label={`${LANG_NAME[a.lang] ?? a.lang} · ${a.verbatim ? "原样提交" : "不是原样提交"}`} lang={a.lang} />}
      {a.errors.length > 0 && <p className="text-xs text-danger">这份记录的格式不对：{a.errors.join("；")}</p>}
      <span className="font-mono text-[11px] text-muted">{a.file}</span>
    </div>
  );
}

const SHOW_RECENT = 5;

/**
 * 尝试记录默认折叠：上面一行汇总（每次一个色块，从旧到新），下面每次尝试只占一行，点开才看笔记和代码。
 * 次数多时只列最近几次，更早的点一下再展开。
 */
function AttemptList({ attempts, slug }: { attempts: Attempt[]; slug: string | null | undefined }) {
  const [showAll, setShowAll] = useState(false);
  const counts = attempts.reduce<Partial<Record<AttemptResult, number>>>((m, a) => ({ ...m, [a.result]: (m[a.result] ?? 0) + 1 }), {});
  const latest = attempts[attempts.length - 1];
  const hidden = showAll ? 0 : Math.max(0, attempts.length - SHOW_RECENT);
  const shown = attempts.slice(hidden);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="font-semibold">共 {attempts.length} 次</span>
          {(Object.keys(RESULT_STYLE) as AttemptResult[]).filter((r) => counts[r]).map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden className={clsx("size-2 rounded-[2px]", RESULT_STYLE[r].dot)} />
              {r} {counts[r]}
            </span>
          ))}
          <span className="text-xs text-muted">· 最近一次 {latest.date} {latest.result}</span>
        </div>
        {/* 每次一个色块，从旧到新 */}
        <div aria-hidden className="flex flex-wrap gap-[3px]" title="每次尝试一个色块，从旧到新">
          {attempts.map((a) => (
            <span key={a.file} className={clsx("size-2.5 rounded-[2px]", RESULT_STYLE[a.result].dot)} />
          ))}
        </div>
      </div>
      {hidden > 0 && (
        <Button className="self-start" size="sm" variant="ghost" onPress={() => setShowAll(true)}>
          显示更早的 {hidden} 次
        </Button>
      )}
      <Accordion allowsMultipleExpanded className="w-full" variant="surface">
        {shown.map((a) => {
          const st = RESULT_STYLE[a.result];
          return (
            <Accordion.Item key={a.file} id={a.file}>
              <Accordion.Heading>
                <Accordion.Trigger>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
                    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", st.chip)}>{a.result}</span>
                    <span className="font-mono text-xs text-muted">
                      {a.date}
                      {a.submittedAt?.slice(11, 16) ? ` ${a.submittedAt.slice(11, 16)}` : ""} · 第 {a.seq} 次 · {LANG_NAME[a.lang] ?? a.lang}
                    </span>
                    {a.source === "practice" && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted" title="在本站题目页的练习区「测试全部」记的，结果按本站的用例判">网站练习</span>}
                    {!a.verbatim && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">不是原样提交</span>}
                  </span>
                  <Accordion.Indicator>
                    <ChevronDown />
                  </Accordion.Indicator>
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
                  <div className="flex flex-col gap-3">
                    {a.submission && (
                      <a
                        className="inline-flex items-center gap-1 self-start rounded-full border border-border px-2 py-0.5 text-xs text-muted no-underline hover:text-foreground"
                        href={slug ? `https://leetcode.cn/problems/${slug}/submissions/${a.submission}/` : `https://leetcode.cn/submissions/detail/${a.submission}/`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        力扣提交 {a.submission}
                        <ExternalIcon />
                      </a>
                    )}
                    <AttemptBody a={a} />
                  </div>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </div>
  );
}

/**
 * 和真实页面一块一块对齐的骨架，数据到了原地淡入。外面也套 problem-page-layout：换题时页面和顶栏的宽度不会先缩回去再撑开。
 * 拿到数据之前不知道是哪种布局，所以写代码布局（桌面上练习区展开）才有的东西——入口那一排、右边的练习区——
 * 都放进来，按 <html data-practice> 和屏幕宽度用 CSS 决定显示哪些（practice.css 的 problem-skel-*），和真实页面的规则一样。
 */
function Loading() {
  return (
    <div className="problem-page-layout" aria-busy>
      <div className="problem-skeleton flex flex-col gap-8 pt-8">
        <div className="flex flex-col gap-4">
          <div className="flex min-h-7 items-center justify-between gap-3">
            <Skel className="h-4 w-36" />
            <Skel className="h-4 w-16 sm:w-40" />
          </div>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-5">
              <Skel className="hidden h-[82px] w-[110px] shrink-0 rounded-2xl sm:block" />
              <div className="flex flex-col gap-3">
                <Skel className="h-8 w-48 rounded-xl sm:h-10 sm:w-64" />
                <Skel className="h-6 w-56" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skel className="h-8 w-[86px] rounded-full" />
              <Skel className="h-8 w-[100px] rounded-full" />
            </div>
          </div>
        </div>

        {/* 写代码布局才有的「卡住了？提示 · 动画 · 题解 …」那一排 */}
        <div className="problem-skel-study">
          <Skel className="me-1 h-3.5 w-11" />
          {["w-[70px]", "w-[46px]", "w-[48px]", "w-[84px]", "w-[76px]", "w-[76px]"].map((w, i) => (
            <span key={i} className={clsx("flex h-8 items-center px-3", i === 4 && "ms-[13px]")}><Skel className={`h-4 ${w}`} /></span>
          ))}
        </div>

        <div className="problem-original-sections">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex h-7 items-center gap-3">
              <Skel className="size-4 rounded-[3px]" />
              <Skel className="h-5 w-24" />
              <Skel className="h-3 w-20" />
            </div>
            <Card className="gap-3 p-5 sm:p-7">
              {["w-[92%]", "w-[84%]", "w-[88%]", "w-[60%]", "", "w-[30%]", "w-[72%]", "w-[80%]", "", "w-[30%]", "w-[66%]", "w-[50%]"].map((w, i) =>
                w ? <Skel key={i} className={`h-4 ${w}`} /> : <span key={i} className="h-2" />,
              )}
            </Card>
            <PixelLoader label="LOADING" />
          </div>
          {/* 正文够宽时右边的「本页」目录（规则和真实页面一样：problem-toc） */}
          <aside className="problem-toc">
            <div className="flex flex-col gap-2">
              <Skel className="mb-2 h-3 w-10" />
              {["w-20", "w-20", "w-20", "w-12", "w-28", "w-20", "w-28"].map((w, i) => <Skel key={i} className={`mx-3 my-1.5 h-4 ${w}`} />)}
            </div>
          </aside>
        </div>
      </div>

      {/* 右边的练习区：和真实的一样钉在顶栏下面、一样宽（拖动条那一列也留着），里面是模式切换、工具栏、编辑器、运行按钮 */}
      <div aria-hidden className="problem-skel-dock-handle"><span /></div>
      <div aria-hidden className="problem-skel-practice">
        <div className="flex items-center justify-between gap-2 px-1 pb-3">
          <Skel className="h-8 w-32 rounded-full" />
          <div className="flex items-center gap-2"><Skel className="h-7 w-20" /><Skel className="h-7 w-14" /></div>
        </div>
        <Card className="min-h-0 flex-1 gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 border-b border-separator px-4 py-3">
            <Skel className="h-4 w-20" />
            <div className="flex items-center gap-1.5"><Skel className="h-8 w-36 rounded-xl" /><Skel className="h-8 w-28 rounded-xl" /><Skel className="size-8 rounded-full" /><Skel className="size-8 rounded-full" /></div>
          </div>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex w-12 shrink-0 flex-col items-center gap-[14px] border-r border-separator pt-[22px]">{[0, 1, 2].map((i) => <Skel key={i} className="h-3 w-2.5" />)}</div>
            <div className="flex flex-1 flex-col gap-[14px] px-2 pt-[22px]"><Skel className="h-3 w-[30%]" /><Skel className="ms-9 h-3 w-[70%]" /><Skel className="ms-9 h-3 w-[22%]" /></div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-separator px-4 py-3">
            <Skel className="h-8 w-16 rounded-full" /><Skel className="h-8 w-24 rounded-full" /><Skel className="h-8 w-36 rounded-full" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * 手写的图解页面（200、215、236）：同源内嵌，只露出演示部分（提示、代码页面上已经有了），
 * 跟随网站的深浅色，高度随内容自动调整，手机上不会被截断。
 */
function HandwrittenDemo({ src }: { src: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const [height, setHeight] = useState(720);
  const [ready, setReady] = useState(false);

  const tune = useCallback(() => {
    const doc = ref.current?.contentDocument;
    if (!doc?.body) return;
    doc.documentElement.dataset.theme = resolvedTheme === "dark" ? "dark" : "light";
    if (!doc.getElementById("embed-style")) {
      const st = doc.createElement("style");
      st.id = "embed-style";
      st.textContent =
        "header,section[aria-labelledby=h-hints],section[aria-labelledby=h-points]{display:none!important}" +
        ".wrap{padding-top:16px!important;padding-bottom:16px!important}body{margin:0;background:transparent!important}";
      doc.head.appendChild(st);
    }
    setHeight(Math.ceil(doc.documentElement.scrollHeight));
    setReady(true);
  }, [resolvedTheme]);

  useEffect(() => {
    tune();
    const doc = ref.current?.contentDocument;
    if (!doc?.body) return;
    const ro = new ResizeObserver(() => setHeight(Math.ceil(doc.documentElement.scrollHeight)));
    ro.observe(doc.body);
    return () => ro.disconnect();
  }, [tune]);

  return (
    <Card className="overflow-hidden p-0">
      {!ready && <PixelLoader label="LOADING" />}
      <iframe
        ref={ref}
        className={clsx("w-full border-0 transition-opacity duration-300", ready ? "opacity-100" : "h-0 opacity-0")}
        src={src}
        style={ready ? { height } : undefined}
        title="动画演示"
        onLoad={tune}
      />
    </Card>
  );
}

/** 相关基础：这道题用到的数据结构和算法专题（专题的 related 里有这道题）。vertical：侧栏里的竖排列表 */
function LearnLinks({ learn, vertical = false }: { learn: NonNullable<ProblemDetail["learn"]>; vertical?: boolean }) {
  if (vertical) {
    return (
      <nav aria-label="相关基础" className="flex flex-col gap-1">
        <span className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">相关基础</span>
        {learn.map((t) => (
          <NextLink
            key={t.slug}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted no-underline transition-colors hover:bg-surface-secondary hover:text-foreground"
            href={`/learn/${t.slug}/`}
            title={`${TOPIC_KIND[t.kind].label}专题：${t.name}`}
          >
            <span aria-hidden className={clsx("size-1.5 shrink-0 rounded-[2px]", t.kind === "ds" ? "bg-accent" : "bg-warning")} />
            {t.name}
          </NextLink>
        ))}
      </nav>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">相关基础</span>
      {learn.map((t) => (
        <NextLink
          key={t.slug}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs no-underline transition-colors hover:border-accent hover:text-accent"
          href={`/learn/${t.slug}/`}
          title={`${TOPIC_KIND[t.kind].label}专题：${t.name}`}
        >
          <span aria-hidden className={clsx("size-1.5 rounded-[2px]", t.kind === "ds" ? "bg-accent" : "bg-warning")} />
          {t.name}
        </NextLink>
      ))}
    </div>
  );
}

function DemoSection({ d, revealed, onReveal }: { d: ProblemDetail; revealed: boolean; onReveal: () => void }) {
  if (d.spec?.demo) return <DemoPlayer codeRevealed={revealed} codes={d.spec.codes} demo={d.spec.demo} onRevealCode={onReveal} />;
  if (d.illustrationUrl) return <HandwrittenDemo src={d.illustrationUrl} />;
  return <p className="text-sm text-muted">这道题还没有动画演示。</p>;
}

/*
 * 「写代码」的布局（桌面上练习区展开时）：一切为写代码服务。
 * 题面一直在；提示、动画、题解、易错点、我的题解、尝试记录都收成题面上方一排入口（滚动时停在顶栏下面），
 * 用到时点一下，从入口下面弹出一个气泡（StudyBubble），编辑器始终看得见；再点入口、点 ✕ 或 Esc 关掉。
 * 练习区收起、或者手机上，回到从上往下读的布局。
 */
type StudyKey = "hints" | "demo" | "solution" | "points" | "history" | "attempts";
type StudyEntry = { key: StudyKey; label: string; title: string; icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactNode; count?: number; mine?: boolean };

function studyEntries(d: ProblemDetail, mine: Mine): StudyEntry[] {
  const counted = (n: number | undefined) => (mine.ready ? n : undefined);
  return [
    { key: "hints", label: "提示", title: "分层提示", icon: BulbIcon, count: d.spec?.hints?.length || undefined },
    { key: "demo", label: "动画", title: "动画演示", icon: PlayIcon },
    { key: "solution", label: "题解", title: "题解", icon: EyeIcon },
    ...(d.spec?.points?.length ? [{ key: "points" as const, label: "易错点", title: "写代码时注意", icon: AlertIcon, count: d.spec.points.length }] : []),
    { key: "history", label: "我的题解", title: "我的历史题解", icon: CodeIcon, mine: true, count: counted(mine.state.history?.length) },
    { key: "attempts", label: "尝试记录", title: "尝试记录", icon: HistoryIcon, mine: true, count: counted(mine.state.attempts?.length) },
  ];
}

/** 一排入口：点一下弹出对应的面板，再点一下（或点面板的关闭）收起 */
function StudyBar({ entries, open, onOpen, label = true }: { entries: StudyEntry[]; open: StudyKey | null; onOpen: (key: StudyKey | null) => void; label?: boolean }) {
  return (
    <div aria-label="提示、演示、题解和我的记录" className="problem-study-entries" role="toolbar">
      {label && <span className="me-1 shrink-0 text-xs text-muted">卡住了？</span>}
      {entries.map((e, i) => (
        <Button
          aria-pressed={open === e.key}
          className={clsx("problem-study-entry", e.mine && !entries[i - 1]?.mine && "problem-study-entry--mine", open === e.key && "is-open")}
          key={e.key}
          onPress={() => onOpen(open === e.key ? null : e.key)}
          size="sm"
          variant="ghost"
        >
          <e.icon aria-hidden />
          {e.label}
          {e.count ? <span className="problem-study-count">{e.count}</span> : null}
        </Button>
      ))}
    </div>
  );
}

/**
 * 提示一层一层给：先只给第一层，「再给一点提示」才往下。
 * 新给的一层只在自己所在的滚动框（气泡）里滚到看得见，不动整个页面。
 */
function HintSteps({ spec }: { spec: Spec }) {
  const [shown, setShown] = useState(1);
  const hints = spec.hints;
  const newest = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = newest.current;
    const box = el?.closest<HTMLElement>(".problem-bubble-body");
    if (shown < 2 || !el || !box) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8;
    if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [shown]);
  return (
    <div className="flex flex-col gap-3">
      {hints.slice(0, shown).map((h, i) => (
        <div className="flex flex-col gap-1.5 rounded-xl bg-surface-secondary px-3.5 py-3" key={i} ref={i === shown - 1 ? newest : undefined}>
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">提示 {i + 1}</span>
            <span className="text-sm font-semibold">{h.t}</span>
          </div>
          <div className="hint-text flex flex-col gap-2 text-sm leading-6 text-muted">
            {h.body.map((p, k) => <p dangerouslySetInnerHTML={{ __html: p }} key={k} />)}
          </div>
        </div>
      ))}
      {shown < hints.length ? (
        <Button className="self-start" onPress={() => setShown(shown + 1)} size="sm" variant="secondary">
          <BulbIcon />再给一点提示（{shown + 1} / {hints.length}）
        </Button>
      ) : (
        <p className="text-xs text-muted">提示就这些了；还卡着可以看看动画演示。</p>
      )}
    </div>
  );
}

/** 内容长的几块（动画、题解、我的题解、尝试记录）用宽气泡：占满题目这一栏，换步骤时宽度不跳；提示、易错点按内容宽 */
const WIDE_KEYS: StudyKey[] = ["demo", "solution", "history", "attempts"];

/**
 * 提示、动画、题解、易错点、我的题解、尝试记录都弹成同一种气泡：挂在那排入口下面（入口那一条停在顶栏下面，气泡跟着它），
 * 小箭头对准点开它的入口；高度按内容、最高到屏幕底下，超出在气泡里滚。
 * 点外面不关（看着提示写代码时要点进编辑器），再点一下入口、点 ✕ 或按 Esc 才关。
 * 打开过的留在里面（提示给到第几层、演示走到第几步、题解看到哪都还在）。不抢焦点、不滚页面。
 */
function StudyBubble({ d, mine, entries, open, onOpen, revealed, onReveal }: {
  d: ProblemDetail; mine: Mine; entries: StudyEntry[]; open: StudyKey | null; onOpen: (key: StudyKey | null) => void; revealed: boolean; onReveal: () => void;
}) {
  const key = open;
  const wide = !!key && WIDE_KEYS.includes(key);
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<Set<StudyKey>>(() => new Set());
  const [pos, setPos] = useState({ x: 8, arrow: 24, max: 480 });
  useEffect(() => {
    if (key) setSeen((s) => (s.has(key) ? s : new Set(s).add(key)));
  }, [key]);
  // 第一次打开就把内容画出来（不等 seen 更新），量宽度时已经是最终的样子
  const has = (k: StudyKey) => seen.has(k) || key === k;
  // 对准点开它的入口；气泡比入口右边剩的地方宽时往左挪，箭头还指着入口。窗口大小变了重新量
  const place = useCallback(() => {
    const el = box.current, bar = el?.parentElement;
    const entry = bar?.querySelector<HTMLElement>(".problem-study-entries [aria-pressed='true']");
    if (!el || !bar || !entry) return;
    const b = bar.getBoundingClientRect(), e = entry.getBoundingClientRect();
    const center = e.left + e.width / 2 - b.left;
    const x = Math.max(8, Math.min(e.left - b.left - 4, b.width - el.offsetWidth - 8));
    // 最高到屏幕底下留 24px（入口那一条停在顶栏下面之后只会更往上，这个高度一直够用）
    setPos({ x, arrow: Math.max(16, Math.min(el.offsetWidth - 16, center - x)), max: Math.max(220, window.innerHeight - b.bottom - 24) });
  }, []);
  useLayoutEffect(() => {
    if (key) place();
  }, [key, place]);
  useEffect(() => {
    if (!key) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || (e.target as Element | null)?.closest?.(".cm-editor, [role=dialog]:not(.problem-bubble)")) return;
      onOpen(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", place); };
  }, [key, onOpen, place]);
  if (!key && !seen.size) return null;
  const current = entries.find((e) => e.key === key);
  const body = (k: StudyKey) => {
    switch (k) {
      case "hints": return d.spec?.hints?.length ? <HintSteps key={d.summary.id} spec={d.spec} /> : <p className="text-sm text-muted">这道题还没有提示。</p>;
      case "demo": return (
        <div className="flex flex-col gap-3">
          {d.illustrationUrl && d.spec?.demo ? <a className="self-end text-xs text-muted no-underline hover:text-accent" href={d.illustrationUrl} rel="noopener" target="_blank">单独打开 ↗</a> : null}
          <DemoSection d={d} onReveal={onReveal} revealed={revealed} />
        </div>
      );
      case "solution": return d.spec?.codes?.length ? <Solutions key={d.summary.id} onReveal={onReveal} revealed={revealed} spec={d.spec} /> : <p className="text-sm text-muted">这道题还没有题解。</p>;
      case "points": return d.spec?.points?.length ? (
        <ul className="flex flex-col gap-2.5">
          {d.spec.points.map((p, i) => (
            <li className="flex flex-col gap-1 rounded-xl bg-surface-secondary px-3.5 py-3" key={i}>
              <div className="text-sm font-semibold">{p.t}</div>
              <p className="hint-text text-[13px] leading-6 text-muted" dangerouslySetInnerHTML={{ __html: p.body }} />
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">这道题还没有易错点。</p>;
      case "history": return <History d={d} mine={mine} />;
      case "attempts": return <Attempts d={d} mine={mine} />;
    }
  };
  return (
    <div
      aria-label={current?.title}
      className={clsx("problem-bubble", wide && "problem-bubble--wide")}
      hidden={!key}
      ref={box}
      role="dialog"
      style={{ "--bubble-x": `${pos.x}px`, "--bubble-arrow": `${pos.arrow}px`, "--bubble-max": `${pos.max}px` } as React.CSSProperties}
    >
      <div className="problem-bubble-head">
        {current && <current.icon aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{current?.title}</span>
        <Button aria-label="关闭" className="shrink-0" isIconOnly onPress={() => onOpen(null)} size="sm" variant="ghost"><CloseIcon /></Button>
      </div>
      <div className="problem-bubble-body">
        {entries.map((e) => (has(e.key) ? <div hidden={e.key !== key} key={e.key}>{body(e.key)}</div> : null))}
      </div>
    </div>
  );
}

function CloseIcon() {
  return <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" viewBox="0 0 16 16" width="16"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

export function ProblemView({ id }: { id: number }) {
  const { data: d, error, loading } = useApi<ProblemDetail>(`/api/problem/${id}`);
  const mine = useMine(id);
  // 题解默认盖着；演示旁边「这一步的代码」跟它共用这个开关，换一道题重新盖上
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);
  useEffect(() => setRevealed(false), [id]);
  // 写代码的布局：练习区展开（桌面）。这时提示、动画这些收成入口，用到时弹出面板
  const coding = useCodingLayout();
  const [sheet, setSheet] = useState<StudyKey | null>(null);
  const openSheet = useCallback((key: StudyKey | null) => {
    setSheet(key);
    if (key === "solution") setRevealed(true); // 点了「题解」就是要看，不再盖一层
  }, []);
  useEffect(() => setSheet(null), [id, coding]);
  const nav = useProblemNav(d);
  // 从上一页的「上一题 / 下一题」过来的：从前进的方向滑进来（只读，不在这里清：开发模式下初始化函数会跑两遍）
  const [enter] = useState(() => enterFrom);
  useEffect(() => { enterFrom = null; }, []);

  useEffect(() => {
    if (d) document.title = `${d.summary.id}. ${d.summary.name} · 热题 100 题解手册`;
  }, [d]);

  if (loading && !d) return <Loading />;
  if (!d) {
    return (
      <EmptyState className="mt-16 rounded-3xl border border-dashed border-border">
        <EmptyState.Header>
          <EmptyState.Title>没能读到这道题</EmptyState.Title>
          <EmptyState.Description>{error}</EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <NextLink className="text-sm text-accent" href="/">
            回到题目列表
          </NextLink>
        </EmptyState.Content>
      </EmptyState>
    );
  }

  const s = d.summary;
  const sections = SECTIONS.filter((x) => (x.id === "points" ? d.spec?.points?.length : true));

  return (
    <PracticeProvider detail={d} key={s.id}>
    <div className="problem-page-layout" data-enter={enter ?? undefined} data-leaving={nav.leaving ?? undefined}>
    <div className={clsx("problem-original flex flex-col gap-8 pt-8", enter ? `problem-enter-${enter}` : "reveal")}>
      <div className="flex flex-col gap-4">
        <div className="flex min-h-7 items-center justify-between gap-3">
          <Breadcrumbs>
            <Breadcrumbs.Item className="no-underline" href="/">
              题目列表
            </Breadcrumbs.Item>
            <Breadcrumbs.Item>{TIER_INFO[s.tier].label}</Breadcrumbs.Item>
          </Breadcrumbs>
          <ProblemPager d={d} nav={nav} />
        </div>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-5">
            <div className="pixel-hover hidden shrink-0 rounded-2xl border border-border bg-surface p-2 shadow-surface sm:block">
              <PixelText className="block h-16 w-auto" label={`第 ${s.id} 题`} pad={1} text={String(s.id)} tone={s.level === "简单" ? "success" : s.level === "中等" ? "warning" : "danger"} />
            </div>
            <div className="flex flex-col gap-3">
              <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-4xl">
                <span className="me-2 font-mono text-muted sm:hidden">{s.id}.</span>
                {s.name}
              </h1>
              {/* 一行就够：难度、专题、重要程度、这道题的状态（登录后点开就能改）。相关基础挪到了侧栏和题面下面 */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <LevelPixels level={s.level} />
                <TopicChip topic={s.topic} />
                <TierChip tier={s.tier} />
                <StatusPicker id={s.id} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {coding ? (
              <Button onPress={() => openSheet("demo")} size="sm" variant="secondary">
                <PlayIcon />
                看动画
              </Button>
            ) : (
              <a className="no-underline" href="#demo">
                <Button size="sm" variant="secondary">
                  <PlayIcon />
                  看动画
                </Button>
              </a>
            )}
            {d.slug && (
              <a className="no-underline" href={`https://leetcode.cn/problems/${d.slug}/`} rel="noopener noreferrer" target="_blank">
                <Button size="sm" variant="outline">
                  力扣原题
                  <ExternalIcon />
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 写代码的布局：一排入口停在顶栏下面，用到时弹出面板 */}
      {coding && (
        <div className="problem-study-bar">
          <StudyBar entries={studyEntries(d, mine)} onOpen={openSheet} open={sheet} />
          <StudyBubble d={d} entries={studyEntries(d, mine)} mine={mine} onOpen={openSheet} onReveal={reveal} open={sheet} revealed={revealed} />
        </div>
      )}

      <div className="problem-original-sections">
        <div className={clsx("flex min-w-0 flex-col", coding ? "gap-8" : "gap-12")}>
          <section className="flex flex-col gap-4">
            <SectionTitle id="statement">题目描述</SectionTitle>
            <Card className="p-5 sm:p-7">
              <PracticeStatement />
            </Card>
            {/* 侧栏（problem-toc）不显示的宽度下，相关基础放在题面下面；显示规则见 practice.css */}
            {d.learn?.length ? <div className="problem-learn-inline"><LearnLinks learn={d.learn} /></div> : null}
          </section>

          {/* 从上往下读的布局（练习区收起、手机）：各节依次排下来 */}
          {!coding && <>
          <section className="flex flex-col gap-4">
            <SectionTitle extra={<span className="text-xs text-muted">卡住了再点开下一层</span>} id="hints">
              分层提示
            </SectionTitle>
            {d.spec?.hints?.length ? <Hints spec={d.spec} /> : <p className="text-sm text-muted">这道题还没有提示。</p>}
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle
              extra={
                d.illustrationUrl && d.spec?.demo ? (
                  <a className="text-xs text-muted no-underline hover:text-accent" href={d.illustrationUrl} rel="noopener" target="_blank">
                    单独打开 ↗
                  </a>
                ) : null
              }
              id="demo"
            >
              动画演示
            </SectionTitle>
            <DemoSection d={d} revealed={revealed} onReveal={reveal} />
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle id="solution">题解</SectionTitle>
            {d.spec?.codes?.length ? <Solutions key={s.id} revealed={revealed} spec={d.spec} onReveal={reveal} /> : <p className="text-sm text-muted">这道题还没有题解。</p>}
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle id="history">我的历史题解</SectionTitle>
            <History d={d} mine={mine} />
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle id="attempts">尝试记录</SectionTitle>
            <Attempts d={d} mine={mine} />
          </section>

          {d.spec?.points?.length ? (
            <section className="flex flex-col gap-4">
              <SectionTitle id="points">写代码时注意</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {d.spec.points.map((p, i) => (
                  <Card key={i} className="gap-1.5 p-4">
                    <div className="text-sm font-semibold">{p.t}</div>
                    <p className="hint-text text-sm leading-6 text-muted" dangerouslySetInnerHTML={{ __html: p.body }} />
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
          </>}

          <nav className="grid gap-3 border-t border-separator pt-6 sm:grid-cols-2">
            {d.prev ? (
              <NextLink className="group flex flex-col gap-1 rounded-2xl border border-border p-4 no-underline transition hover:border-accent" href={`/p/${d.prev.id}/`} {...nav.link(d.prev.id, "prev")}>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <ChevronLeft height={12} width={12} />
                  上一题（按重要程度）
                </span>
                <span className="font-semibold group-hover:text-accent">
                  {d.prev.id}. {d.prev.name}
                </span>
              </NextLink>
            ) : (
              <span />
            )}
            {d.next && (
              <NextLink className="group flex flex-col items-end gap-1 rounded-2xl border border-border p-4 text-right no-underline transition hover:border-accent" href={`/p/${d.next.id}/`} {...nav.link(d.next.id, "next")}>
                <span className="flex items-center gap-1 text-xs text-muted">
                  下一题（按重要程度）
                  <ChevronRight height={12} width={12} />
                </span>
                <span className="font-semibold group-hover:text-accent">
                  {d.next.id}. {d.next.name}
                </span>
              </NextLink>
            )}
          </nav>
        </div>

        <aside className="problem-toc">
          <div className="sticky top-24 flex flex-col gap-6">
            <nav aria-label="本页" className="flex flex-col gap-1">
              <span className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">本页</span>
              {sections.map((x) => (
                <a key={x.id} className="rounded-lg px-3 py-1.5 text-sm text-muted no-underline transition-colors hover:bg-surface-secondary hover:text-foreground" href={`#${x.id}`}>
                  {x.label}
                </a>
              ))}
            </nav>
            {d.learn?.length ? <LearnLinks vertical learn={d.learn} /> : null}
          </div>
        </aside>
      </div>
    </div>
    <PracticeWorkbench />
    </div>
    </PracticeProvider>
  );
}
