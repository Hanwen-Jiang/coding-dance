"use client";

import { Card, Chip } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import clsx from "clsx";
import NextLink from "next/link";

import { PixelTitle, STATUS_TONE, Skel } from "@/components/pixel";
import { useProgress } from "@/lib/progress";
import type { Status, TopicKind, TopicSummary } from "@/lib/types";
import { TOPIC_KIND } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const KINDS: TopicKind[] = ["ds", "algo"];
const solved = (s: Status) => s === "已通过" || s === "曾通过";

/** 一个专题的卡片：序号、名字、简介、小节，底部是相关热题的完成情况（每题一个像素格） */
function TopicCard({ t, i, statusOf, ready }: { t: TopicSummary; i: number; statusOf: (id: number) => Status; ready: boolean }) {
  const done = t.related.filter((id) => solved(statusOf(id))).length;
  return (
    <NextLink
      className="reveal-item group block h-full rounded-3xl no-underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
      href={`/learn/${t.slug}/`}
      style={{ "--i": i } as React.CSSProperties}
    >
      <Card className="h-full gap-3 p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={clsx("font-pixel text-[11px] tracking-wider", t.kind === "ds" ? "text-accent" : "text-warning")}>
            {t.kind === "ds" ? "DS" : "ALGO"}·{String(t.order).padStart(2, "0")}
          </span>
          <span className="text-[11px] text-muted">{t.sections.length} 小节</span>
        </div>
        <div className="text-base font-semibold leading-snug transition-colors group-hover:text-accent">{t.name}</div>
        <p className="line-clamp-2 text-sm leading-6 text-muted">{t.lede}</p>
        <div className="flex flex-wrap gap-1.5">
          {t.sections.map((s) => (
            <span key={s.key} className="rounded-md bg-foreground/[0.05] px-1.5 py-0.5 text-[11px] text-muted">
              {s.t}
            </span>
          ))}
        </div>
        {t.related.length > 0 && (
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-separator pt-3">
            <span aria-hidden className="flex flex-wrap gap-[3px]">
              {t.related.map((id) => (
                <span key={id} className={clsx("size-[7px] rounded-[2px]", ready ? STATUS_TONE[statusOf(id)] : "bg-foreground/15")} />
              ))}
            </span>
            <span className="shrink-0 text-[11px] text-muted tabular-nums">
              {ready ? `相关热题做完 ${done}/${t.related.length}` : `相关热题 ${t.related.length} 道`}
            </span>
          </div>
        )}
      </Card>
    </NextLink>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="h-[200px] gap-3 p-5">
          <Skel className="h-3 w-16" />
          <Skel className="h-5 w-2/5" />
          <Skel className="h-4 w-full" />
          <Skel className="h-4 w-4/5" />
        </Card>
      ))}
    </div>
  );
}

export function TopicList() {
  const { data, error, loading } = useApi<{ topics: TopicSummary[] }>("/api/topics");
  const { ready, statusOf } = useProgress();
  const topics = data?.topics ?? [];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 pt-10 sm:pt-14">
        <span className="font-pixel text-[11px] tracking-[0.2em] text-accent">LEARN · DATA STRUCTURES & ALGORITHMS</span>
        <PixelTitle as="h1" cell={4} px={16} text="数据结构与算法基础" weight={700} />
        <PixelTitle as="p" cell={2.5} className="text-muted" px={12} text="讲解 · 动画 · 六种语言的代码" weight={500} />
        <p className="max-w-2xl text-[15px] leading-7 text-muted">
          刷热题之前先把基本功补齐：常用的数据结构怎么定义、怎么构造，常见的算法有什么固定写法。每个专题分几小节，配逐步演示（每一步高亮正在执行的代码）和六种语言的代码，最后列出用到它的热题。
        </p>
      </section>

      {error && !data ? (
        <EmptyState className="rounded-3xl border border-dashed border-border">
          <EmptyState.Header>
            <EmptyState.Title>没能读到专题列表</EmptyState.Title>
            <EmptyState.Description>{error}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : loading && !data ? (
        <LoadingGrid />
      ) : (
        KINDS.map((kind) => {
          const items = topics.filter((t) => t.kind === kind);
          if (!items.length) return null;
          return (
            <section key={kind} className="flex flex-col gap-3" id={kind}>
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-bold">{TOPIC_KIND[kind].label}</h2>
                <Chip size="sm" variant="secondary">
                  {items.length}
                </Chip>
                <span className="hidden text-sm text-muted sm:inline">{TOPIC_KIND[kind].desc}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((t, i) => (
                  <TopicCard key={t.slug} i={i} ready={ready} statusOf={statusOf} t={t} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
