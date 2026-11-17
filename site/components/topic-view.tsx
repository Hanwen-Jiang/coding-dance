"use client";

import { Breadcrumbs, Card, Tabs } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import clsx from "clsx";
import NextLink from "next/link";
import { useEffect } from "react";

import { DemoPlayer } from "@/components/demo/demo-player";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { LevelPixels, PixelBullet, PixelLoader, PixelTitle, Skel, StatusPixel } from "@/components/pixel";
import { SolutionCode } from "@/components/solution-code";
import { TierChip } from "@/components/tags";
import { useProgress } from "@/lib/progress";
import type { ProblemSummary, TopicDetail, TopicSection } from "@/lib/types";
import { TOPIC_KIND } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function SectionTitle({ id, n, children, en }: { id: string; n: number; children: React.ReactNode; en: string }) {
  return (
    <h2 className="flex scroll-mt-20 items-center gap-3 text-xl font-bold" id={id}>
      <PixelBullet />
      <span>
        <span className="me-2 font-mono text-muted">{n}.</span>
        {children}
      </span>
      <span className="font-pixel text-[10px] font-normal tracking-widest text-muted uppercase">{en}</span>
    </h2>
  );
}

/** 一小节的代码：多段时用标签页切换，每段按用户的常用语言显示 */
function SectionCodes({ sec }: { sec: TopicSection }) {
  const one = (c: TopicSection["codes"][number]) => (
    <div className="flex flex-col gap-3">
      {c.note && <p className="hint-text text-sm leading-6 text-muted" dangerouslySetInnerHTML={{ __html: c.note }} />}
      <SolutionCode code={c} />
    </div>
  );
  if (sec.codes.length === 1) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">代码 · {sec.codes[0].t}</div>
        {one(sec.codes[0])}
      </div>
    );
  }
  return (
    <Tabs className="w-full">
      <Tabs.ListContainer className="max-w-full overflow-x-auto">
        <Tabs.List aria-label={`${sec.t}的代码`}>
          {sec.codes.map((c, i) => (
            <Tabs.Tab key={i} id={String(i)}>
              {c.t}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {sec.codes.map((c, i) => (
        <Tabs.Panel key={i} className="pt-4" id={String(i)}>
          {one(c)}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

function Section({ sec, n }: { sec: TopicSection; n: number }) {
  return (
    <section className="flex flex-col gap-5">
      <SectionTitle en={sec.key} id={sec.key} n={n}>
        {sec.t}
      </SectionTitle>
      <div className="hint-text flex max-w-3xl flex-col gap-3 text-[15px] leading-7">
        {sec.body.map((p, i) => (
          <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
        ))}
      </div>
      {sec.demo && (
        <div className="flex flex-col gap-3">
          <div className="font-pixel text-[11px] tracking-wider text-muted">DEMO · {sec.demo.title}</div>
          <DemoPlayer codes={sec.codes} demo={sec.demo} />
        </div>
      )}
      <SectionCodes sec={sec} />
      {sec.points.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {sec.points.map((p, i) => (
            <Card key={i} className="gap-1.5 p-4">
              <div className="text-sm font-semibold">{p.t}</div>
              <p className="hint-text text-sm leading-6 text-muted" dangerouslySetInnerHTML={{ __html: p.body }} />
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/** 相关热题：每题一张小卡片，登录后显示自己的状态 */
function Related({ problems }: { problems: ProblemSummary[] }) {
  const { ready, statusOf } = useProgress();
  if (!problems.length) return <p className="text-sm text-muted">热题 100 里暂时没有直接对应的题。</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {problems.map((p) => (
        <NextLink key={p.id} className="group block rounded-3xl no-underline outline-none focus-visible:ring-2 focus-visible:ring-accent" href={`/p/${p.id}/`}>
          <Card className="h-full gap-2 p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[11px] tracking-wider text-muted">#{p.id}</span>
              {ready && <StatusPixel status={statusOf(p.id)} />}
            </div>
            <div className="font-semibold leading-snug transition-colors group-hover:text-accent">{p.name}</div>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <LevelPixels level={p.level} />
              <TierChip tier={p.tier} />
            </div>
          </Card>
        </NextLink>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8" aria-busy>
      <div className="flex flex-col gap-4">
        <Skel className="h-4 w-36" />
        <Skel className="h-10 w-64 rounded-xl" />
        <Skel className="h-5 w-full max-w-2xl" />
        <Skel className="h-5 w-3/4 max-w-xl" />
      </div>
      <PixelLoader label="LOADING" />
    </div>
  );
}

export function TopicView({ slug }: { slug: string }) {
  const { data: d, error, loading } = useApi<TopicDetail>(`/api/topic/${slug}`);
  const { ready, statusOf } = useProgress();

  useEffect(() => {
    if (d) document.title = `${d.topic.name} · 数据结构与算法基础 · 热题 100 题解手册`;
  }, [d]);

  if (loading && !d) return <Loading />;
  if (!d) {
    return (
      <EmptyState className="mt-16 rounded-3xl border border-dashed border-border">
        <EmptyState.Header>
          <EmptyState.Title>没能读到这个专题</EmptyState.Title>
          <EmptyState.Description>{error}</EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <NextLink className="text-sm text-accent" href="/learn/">
            回到专题列表
          </NextLink>
        </EmptyState.Content>
      </EmptyState>
    );
  }

  const t = d.topic, kind = TOPIC_KIND[t.kind];
  const done = d.problems.filter((p) => ["已通过", "曾通过"].includes(statusOf(p.id))).length;
  const toc = [...t.sections.map((s, i) => ({ id: s.key, label: `${i + 1}. ${s.t}` })), { id: "problems", label: "相关热题" }];

  return (
    <div className="reveal flex flex-col gap-8 pt-8">
      <div className="flex flex-col gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item className="no-underline" href="/learn/">
            基础专题
          </Breadcrumbs.Item>
          <Breadcrumbs.Item className="no-underline" href={`/learn/#${t.kind}`}>
            {kind.label}
          </Breadcrumbs.Item>
        </Breadcrumbs>
        <span className={clsx("font-pixel text-[11px] tracking-[0.2em]", t.kind === "ds" ? "text-accent" : "text-warning")}>
          {kind.en} · {String(t.order).padStart(2, "0")}
        </span>
        <PixelTitle as="h1" cell={3.5} px={16} text={t.name} weight={700} />
        <p className="max-w-3xl text-[15px] leading-7 text-muted">{t.lede}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <span>{t.sections.length} 小节</span>
          <span>{t.sections.filter((s) => s.demo).length} 个演示</span>
          {d.problems.length > 0 && (
            <a className="no-underline hover:text-accent" href="#problems">
              {ready ? `相关热题做完 ${done}/${d.problems.length}` : `相关热题 ${d.problems.length} 道`}
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex min-w-0 flex-col gap-14">
          {t.sections.map((sec, i) => (
            <Section key={sec.key} n={i + 1} sec={sec} />
          ))}

          <section className="flex flex-col gap-4">
            <SectionTitle en="practice" id="problems" n={t.sections.length + 1}>
              相关热题
            </SectionTitle>
            <p className="text-sm text-muted">学完这个专题，可以拿下面这些热题练手。</p>
            <Related problems={d.problems} />
          </section>

          <nav className="grid gap-3 border-t border-separator pt-6 sm:grid-cols-2">
            {d.prev ? (
              <NextLink className="group flex flex-col gap-1 rounded-2xl border border-border p-4 no-underline transition hover:border-accent" href={`/learn/${d.prev.slug}/`}>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <ChevronLeft height={12} width={12} />
                  上一个专题
                </span>
                <span className="font-semibold group-hover:text-accent">{d.prev.name}</span>
              </NextLink>
            ) : (
              <span />
            )}
            {d.next && (
              <NextLink className="group flex flex-col items-end gap-1 rounded-2xl border border-border p-4 text-right no-underline transition hover:border-accent" href={`/learn/${d.next.slug}/`}>
                <span className="flex items-center gap-1 text-xs text-muted">
                  下一个专题
                  <ChevronRight height={12} width={12} />
                </span>
                <span className="font-semibold group-hover:text-accent">{d.next.name}</span>
              </NextLink>
            )}
          </nav>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-1">
            <span className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">本页</span>
            {toc.map((x) => (
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
