"use client";

import { Accordion, Breadcrumbs, Button, Card, Tabs } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import clsx from "clsx";
import NextLink from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

import { CodePanel } from "@/components/code-panel";
import { DemoPlayer } from "@/components/demo/demo-player";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalIcon, EyeIcon, HistoryIcon, PlayIcon } from "@/components/icons";
import { LevelPixels, PixelBullet, PixelLoader, PixelText, Skel, StatusPixel } from "@/components/pixel";
import { TierChip, TopicChip } from "@/components/tags";
import type { ProblemDetail, Spec } from "@/lib/types";
import { TIER_INFO } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const SECTIONS = [
  { id: "statement", label: "题目描述", en: "PROBLEM" },
  { id: "hints", label: "分层提示", en: "HINTS" },
  { id: "demo", label: "动画演示", en: "DEMO" },
  { id: "solution", label: "题解", en: "SOLUTION" },
  { id: "history", label: "我的历史题解", en: "MY CODE" },
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

function Solutions({ spec }: { spec: Spec }) {
  const [revealed, setRevealed] = useState(false);
  const elegantIdx = spec.codes.findIndex((c) => c.kind === "elegant");
  const same = elegantIdx === 0;
  const tabs = [
    ...(elegantIdx >= 0 ? [{ id: "elegant", label: same ? "简洁 · 标准" : "优雅简洁", code: spec.codes[elegantIdx] }] : []),
    ...(!same ? [{ id: "standard", label: "标准题解", code: spec.codes[0] }] : []),
    ...spec.codes
      .map((c, i) => ({ c, i }))
      .filter(({ i }) => i !== 0 && i !== elegantIdx)
      .map(({ c, i }) => ({ id: `alt-${i}`, label: c.t.split("：")[0] || "其他写法", code: c })),
  ];

  if (!revealed) {
    return (
      <Card className="relative items-center gap-4 overflow-hidden px-6 py-10 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 blur-[6px]">
          <pre className="whitespace-pre p-6 text-left font-mono text-xs leading-6 text-muted">{tabs[0]?.code.code}</pre>
        </div>
        <div className="relative flex flex-col items-center gap-3">
          <span className="font-pixel text-[11px] tracking-widest text-muted">SPOILER</span>
          <Button onPress={() => setRevealed(true)}>
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
      <Tabs className="w-full" defaultSelectedKey={tabs[0]?.id}>
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
            <CodePanel code={t.code.code} label="Python 3" lang="python" />
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}

function History({ d }: { d: ProblemDetail }) {
  if (!d.history.length) {
    return (
      <EmptyState className="rounded-3xl border border-dashed border-border" size="sm">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <HistoryIcon />
          </EmptyState.Media>
          <EmptyState.Title>还没有我的提交</EmptyState.Title>
          <EmptyState.Description>通过后把代码存进仓库的 solutions/ 目录，这里会自动出现。</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  }
  return (
    <Tabs className="w-full" defaultSelectedKey={d.history[0].file}>
      <Tabs.ListContainer>
        <Tabs.List aria-label="历史题解">
          {d.history.map((h) => (
            <Tabs.Tab key={h.file} id={h.file}>
              {h.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {d.history.map((h) => (
        <Tabs.Panel key={h.file} className="flex flex-col gap-2 pt-4" id={h.file}>
          <span className="font-mono text-xs text-muted">{h.file}</span>
          <CodePanel code={h.code} label={h.label} lang={h.lang} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

/** 和真实页面同样布局的骨架，数据到了原地淡入 */
function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8" aria-busy>
      <div className="flex flex-col gap-4">
        <Skel className="h-4 w-36" />
        <div className="flex items-center gap-5">
          <Skel className="hidden h-[82px] w-[150px] rounded-2xl sm:block" />
          <div className="flex flex-col gap-3">
            <Skel className="h-9 w-64 rounded-xl" />
            <Skel className="h-5 w-44" />
          </div>
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex flex-col gap-4">
          <Skel className="h-6 w-32" />
          <Card className="gap-3 p-5 sm:p-7">
            {["w-[92%]", "w-[84%]", "w-[88%]", "w-[60%]", "", "w-[72%]", "w-[80%]", "w-[50%]"].map((w, i) =>
              w ? <Skel key={i} className={`h-4 ${w}`} /> : <span key={i} className="h-2" />,
            )}
          </Card>
          <PixelLoader label="LOADING" />
        </div>
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

function DemoSection({ d }: { d: ProblemDetail }) {
  if (d.spec?.demo) return <DemoPlayer demo={d.spec.demo} />;
  if (d.illustrationUrl) return <HandwrittenDemo src={d.illustrationUrl} />;
  return <p className="text-sm text-muted">这道题还没有动画演示。</p>;
}

export function ProblemView({ id }: { id: number }) {
  const { data: d, error, loading } = useApi<ProblemDetail>(`/api/problem/${id}`);

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
    <div className="reveal flex flex-col gap-8 pt-8">
      <div className="flex flex-col gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item className="no-underline" href="/">
            题目列表
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>{TIER_INFO[s.tier].label}</Breadcrumbs.Item>
        </Breadcrumbs>
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
              <div className="flex flex-wrap items-center gap-3">
                <LevelPixels level={s.level} />
                <TopicChip topic={s.topic} />
                <TierChip tier={s.tier} />
                <StatusPixel status={s.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="no-underline" href="#demo">
              <Button size="sm" variant="secondary">
                <PlayIcon />
                看动画
              </Button>
            </a>
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

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex min-w-0 flex-col gap-12">
          <section className="flex flex-col gap-4">
            <SectionTitle id="statement">题目描述</SectionTitle>
            <Card className="p-5 sm:p-7">
              {d.statementHtml ? <div className="statement" dangerouslySetInnerHTML={{ __html: d.statementHtml }} /> : <p className="text-muted">仓库里还没有这道题的题面。</p>}
            </Card>
          </section>

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
            <DemoSection d={d} />
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle id="solution">题解</SectionTitle>
            {d.spec?.codes?.length ? <Solutions key={s.id} spec={d.spec} /> : <p className="text-sm text-muted">这道题还没有题解。</p>}
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle id="history">我的历史题解</SectionTitle>
            <History d={d} />
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

          <nav className="grid gap-3 border-t border-separator pt-6 sm:grid-cols-2">
            {d.prev ? (
              <NextLink className="group flex flex-col gap-1 rounded-2xl border border-border p-4 no-underline transition hover:border-accent" href={`/p/${d.prev.id}/`}>
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
              <NextLink className="group flex flex-col items-end gap-1 rounded-2xl border border-border p-4 text-right no-underline transition hover:border-accent" href={`/p/${d.next.id}/`}>
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

        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-1">
            <span className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">本页</span>
            {sections.map((x) => (
              <a key={x.id} className="rounded-lg px-3 py-1.5 text-sm text-muted no-underline transition-colors hover:bg-surface-secondary hover:text-foreground" href={`#${x.id}`}>
                {x.label}
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
