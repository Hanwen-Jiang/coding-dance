"use client";

import { Card, Chip, SearchField } from "@heroui/react";
import { EmptyState, KPIGroup, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import NextLink from "next/link";
import { useEffect, useMemo, useState } from "react";

import { HistoryIcon, PlayIcon, SearchOffIcon } from "@/components/icons";
import { LevelPixels, PixelTitle, ProgressMatrix, Skel, StatusPixel, TYPING_WORDS, TypingPixels } from "@/components/pixel";
import { TierChip, TopicChip, langShort } from "@/components/tags";
import { LoginHint, SetupCard } from "@/components/account";
import { useProgress } from "@/lib/progress";
import type { IndexData, Problem, Status } from "@/lib/types";
import { LEVEL_ORDER, TIER_INFO, TIER_ORDER, byImportance } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type GroupBy = "tier" | "level" | "topic";
type StatusFilter = "all" | Status;

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: "tier", label: "重要程度" },
  { id: "level", label: "难度" },
  { id: "topic", label: "题型" },
];
const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "未开始", label: "未开始" },
  { id: "尝试过", label: "尝试过" },
  { id: "曾通过", label: "曾通过" },
  { id: "已通过", label: "已通过" },
];

function usePersisted<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) setV(s as T);
    } catch {}
  }, [key]);
  const set = (x: T) => {
    setV(x);
    try {
      localStorage.setItem(key, x);
    } catch {}
  };
  return [v, set];
}

function ProblemCard({ p, groupBy, i }: { p: Problem; groupBy: GroupBy; i: number }) {
  return (
    <NextLink
      className="reveal-item group block h-full rounded-3xl no-underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
      href={`/p/${p.id}/`}
      style={{ "--i": i } as React.CSSProperties}
    >
      <Card className="h-full min-h-[118px] gap-3 p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[11px] tracking-wider text-muted">#{p.id}</span>
          <StatusPixel status={p.status} />
        </div>
        <div className="text-[15px] font-semibold leading-snug transition-colors group-hover:text-accent">{p.name}</div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <LevelPixels level={p.level} />
          {groupBy !== "topic" && <TopicChip topic={p.topic} />}
          {groupBy !== "tier" && <TierChip tier={p.tier} />}
          <span className="ml-auto flex items-center gap-2 text-[11px] text-muted">
            {p.langs.length > 0 && (
              <span className="inline-flex items-center gap-1" title="有我的历史题解">
                <HistoryIcon height={12} width={12} />
                {p.langs.map(langShort).join(" · ")}
              </span>
            )}
            {p.hasIllustration && (
              <span className="inline-flex items-center" title="有交互图解">
                <PlayIcon height={12} width={12} />
              </span>
            )}
          </span>
        </div>
      </Card>
    </NextLink>
  );
}

/** 首页右侧的打字机：不加卡片，直接落在点阵底纹上；下面一行跟着当前的词换 */
function HeroTyping() {
  const [i, setI] = useState(0);
  return (
    <div className="pixel-hover flex flex-col gap-3">
      <TypingPixels className="block h-auto w-full" onWord={setI} />
      <div key={i} className="dm-fade-in truncate font-mono text-xs text-muted">
        {TYPING_WORDS[i].note}
      </div>
    </div>
  );
}

/** 和真实卡片同样尺寸的骨架，数据到了直接换成卡片，不会跳 */
function LoadingGrid() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skel className="h-6 w-28" />
        <Skel className="h-5 w-8" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Card key={i} className="h-[118px] gap-3 p-4">
            <div className="flex justify-between">
              <Skel className="h-3 w-10" />
              <Skel className="h-3 w-12" />
            </div>
            <Skel className="h-4 w-2/3" />
            <div className="mt-auto flex gap-2">
              <Skel className="h-5 w-14" />
              <Skel className="h-5 w-12 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ProblemList() {
  const { data, error, loading } = useApi<IndexData>("/api/problems");
  const [groupBy, setGroupBy] = usePersisted<GroupBy>("lc.groupBy", "tier");
  const [filter, setFilter] = usePersisted<StatusFilter>("lc.status", "all");
  const [query, setQuery] = useState("");

  // 题目资源对所有人一样；状态和题解来自当前用户的进度仓（没登录就是 0 进度）
  const { loading: sessionLoading, statusOf, langsOf } = useProgress();
  const problems: Problem[] = useMemo(
    () => (data?.problems ?? []).map((p) => ({ ...p, status: statusOf(p.id), langs: langsOf(p.id) })),
    [data, statusOf, langsOf],
  );
  const ready = !!data && !sessionLoading;
  const counts = useMemo(() => {
    const c = { 已通过: 0, 曾通过: 0, 尝试过: 0, 未开始: 0, history: 0, spec: 0 };
    for (const p of problems) {
      c[p.status]++;
      if (p.langs.length) c.history++;
      if (p.hasSpec) c.spec++;
    }
    return c;
  }, [problems]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = problems
      .filter((p) => filter === "all" || p.status === filter)
      .filter((p) => !q || String(p.id) === q || p.name.toLowerCase().includes(q) || p.topic.includes(q));
    const make = (keys: string[], key: (p: Problem) => string, sort: (a: Problem, b: Problem) => number) =>
      keys
        .map((k) => ({ key: k, items: shown.filter((p) => key(p) === k).sort(sort) }))
        .filter((g) => g.items.length);
    if (groupBy === "tier") return make(TIER_ORDER, (p) => p.tier, byImportance);
    if (groupBy === "level") return make(LEVEL_ORDER, (p) => p.level, byImportance);
    return make(data?.topics ?? [], (p) => p.topic, (a, b) => a.planOrder - b.planOrder);
  }, [problems, data, groupBy, filter, query]);

  const total = problems.length || 100;
  const shownCount = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-10 sm:pt-14">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="flex flex-col gap-4">
            <span className="font-pixel text-[11px] tracking-[0.2em] text-accent">LEETCODE · TOP 100 LIKED</span>
            <PixelTitle as="h1" cell={4} px={16} text="热题 100 题解手册" weight={700} />
            <PixelTitle as="p" cell={2.5} className="text-muted" px={12} text="提示 · 动画 · 题解 · 我的提交" weight={500} />
          </div>
          <HeroTyping />
        </div>
        <div className="mt-10 flex flex-col gap-4">
          <KPIGroup>
            {(
              [
                ["已通过", counts.已通过],
                ["曾通过 · 待复习", counts.曾通过],
                ["尝试过 · 未通过", counts.尝试过],
                ["未开始", counts.未开始],
                ["有我的题解", counts.history],
              ] as const
            ).flatMap(([title, value], i) => [
              ...(i ? [<KPIGroup.Separator key={`s${i}`} />] : []),
              <KPI key={title}>
                <KPI.Header>
                  <KPI.Title>{title}</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  {/* 数据到之前用骨架占住同样的高度，不显示一个假的 0 */}
                  {ready ? <KPI.Value maximumFractionDigits={0} value={value} /> : <Skel className="my-1 h-7 w-14" />}
                </KPI.Content>
              </KPI>,
            ])}
          </KPIGroup>
          <Card className="gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span className="font-pixel tracking-wider">PROGRESS · {ready ? `${counts.已通过 + counts.曾通过}/${total}` : "--/100"}</span>
              <span className="flex items-center gap-3">
                <StatusPixel status="已通过" />
                <StatusPixel status="曾通过" />
                <StatusPixel status="尝试过" />
                <StatusPixel status="未开始" />
              </span>
            </div>
            <ProgressMatrix problems={ready ? problems.slice().sort(byImportance) : null} />
          </Card>
          <SetupCard />
          <LoginHint />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="z-30 -mx-4 flex flex-col gap-3 border-b border-separator bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:sticky md:top-14 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Segment aria-label="分组方式" selectedKey={groupBy} onSelectionChange={(k) => setGroupBy(k as GroupBy)}>
              {GROUPS.map((g) => (
                <Segment.Item key={g.id} id={g.id}>
                  {g.label}
                </Segment.Item>
              ))}
            </Segment>
            <Segment aria-label="状态筛选" selectedKey={filter} size="sm" variant="ghost" onSelectionChange={(k) => setFilter(k as StatusFilter)}>
              {FILTERS.map((f) => (
                <Segment.Item key={f.id} id={f.id}>
                  {f.label}
                </Segment.Item>
              ))}
            </Segment>
          </div>
          <SearchField aria-label="搜索题目" className="md:w-64" value={query} onChange={setQuery}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="题号、题名或题型" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>

        {error && !data ? (
          <EmptyState className="rounded-3xl border border-dashed border-border">
            <EmptyState.Header>
              <EmptyState.Title>没能读到题目数据</EmptyState.Title>
              <EmptyState.Description>{error}</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ) : loading && !data ? (
          <LoadingGrid />
        ) : shownCount === 0 ? (
          <EmptyState className="rounded-3xl border border-dashed border-border">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <SearchOffIcon />
              </EmptyState.Media>
              <EmptyState.Title>没有符合条件的题目</EmptyState.Title>
              <EmptyState.Description>换个关键词，或者把状态筛选改回「全部」。</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-bold">{groupBy === "tier" ? TIER_INFO[g.key as keyof typeof TIER_INFO].label : g.key}</h2>
                <Chip size="sm" variant="secondary">
                  {g.items.length}
                </Chip>
                {groupBy === "tier" && <span className="hidden text-sm text-muted sm:inline">{TIER_INFO[g.key as keyof typeof TIER_INFO].desc}</span>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p, i) => (
                  <ProblemCard key={p.id} groupBy={groupBy} i={i} p={p} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
