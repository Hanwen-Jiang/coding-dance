"use client";

import { Button, Chip, SearchField } from "@heroui/react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

import { LevelPixels, StatusPixel } from "@/components/pixel";
import { useProgress } from "@/lib/progress";
import type { IndexData, Problem, Status } from "@/lib/types";
import { byImportance } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type DrawerFilter = "all" | "todo" | "attempted" | "solved";

const FILTERS: { id: DrawerFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "todo", label: "未开始" },
  { id: "attempted", label: "尝试过" },
  { id: "solved", label: "已通过" },
];

/**
 * 题目页默认折叠、可随时召出的左侧「题单速切抽屉」（支持 Cmd/Ctrl+K 快捷键与搜索/状态筛选）。
 */
export function ProblemDrawer({
  currentId,
  onSelectProblem,
}: {
  currentId: number;
  onSelectProblem: (id: number, dir: "prev" | "next") => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DrawerFilter>("all");
  const { data } = useApi<IndexData>("/api/problems");
  const { statusOf, langsOf, ready } = useProgress();
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      activeItemRef.current?.scrollIntoView({ block: "center" });
      searchWrapRef.current?.querySelector("input")?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const problems: Problem[] = useMemo(
    () =>
      (data?.problems ?? [])
        .map((p) => ({ ...p, status: statusOf(p.id), langs: langsOf(p.id) }))
        .sort(byImportance),
    [data, statusOf, langsOf],
  );

  const currentOrder = useMemo(
    () => problems.find((p) => p.id === currentId)?.order ?? null,
    [problems, currentId],
  );

  const solvedCount = useMemo(
    () => problems.filter((p) => p.status === "已通过" || p.status === "曾通过").length,
    [problems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      if (filter === "todo" && p.status !== "未开始") return false;
      if (filter === "attempted" && p.status !== "尝试过") return false;
      if (filter === "solved" && p.status !== "已通过" && p.status !== "曾通过") return false;
      if (!q) return true;
      return String(p.id).includes(q) || p.name.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q);
    });
  }, [problems, filter, query]);

  const pick = (p: Problem) => {
    if (p.id === currentId) {
      setOpen(false);
      return;
    }
    const dir = currentOrder != null && p.order < currentOrder ? "prev" : "next";
    setOpen(false);
    onSelectProblem(p.id, dir);
  };

  return (
    <>
      <Button
        aria-expanded={open}
        aria-label="打开快速选题列表（快捷键 ⌘/Ctrl + K）"
        className="h-7 min-h-7 gap-1.5 rounded-lg px-2 text-xs text-muted hover:text-foreground"
        data-testid="problem-drawer-trigger"
        onPress={() => setOpen(true)}
        size="sm"
        variant="ghost"
      >
        <ListDrawerIcon />
        <span>题单</span>
        <span className="hidden font-mono text-[10px] opacity-60 sm:inline">⌘K</span>
      </Button>

      {open && (
        <div
          aria-label="热题 100 选题列表"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex"
          data-testid="problem-drawer"
          role="dialog"
        >
          <div
            aria-hidden
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex h-full w-[min(92vw,380px)] flex-col border-r border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-separator px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[11px] tracking-wider text-accent">HOT 100</span>
                <span className="text-sm font-bold">快速选题</span>
                {ready && problems.length > 0 && (
                  <Chip size="sm" variant="soft">
                    {solvedCount}/{problems.length}
                  </Chip>
                )}
              </div>
              <Button
                aria-label="关闭选题列表"
                className="h-7 w-7 min-w-7 p-0"
                isIconOnly
                onPress={() => setOpen(false)}
                size="sm"
                variant="ghost"
              >
                ×
              </Button>
            </div>

            <div className="flex flex-col gap-2.5 border-b border-separator px-4 py-3">
              <div ref={searchWrapRef}>
                <SearchField aria-label="搜索题号、题名或题型" className="w-full" value={query} onChange={setQuery}>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="搜题号、题名或题型…" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="按进度筛选">
                {FILTERS.map((f) => (
                  <button
                    aria-pressed={filter === f.id}
                    className={clsx(
                      "rounded-md px-2 py-0.5 text-xs transition-colors",
                      filter === f.id
                        ? "bg-accent/12 font-medium text-accent"
                        : "text-muted hover:bg-surface-secondary hover:text-foreground",
                    )}
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    type="button"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted">没有匹配的题目。</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filtered.map((p) => {
                    const active = p.id === currentId;
                    return (
                      <li key={p.id}>
                        <button
                          className={clsx(
                            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            active
                              ? "bg-accent/12 text-foreground"
                              : "hover:bg-surface-secondary text-foreground/90",
                          )}
                          onClick={() => pick(p)}
                          ref={active ? activeItemRef : undefined}
                          type="button"
                        >
                          <StatusPixel status={p.status as Status} />
                          <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-muted">
                            #{p.id}
                          </span>
                          <span className={clsx("min-w-0 flex-1 truncate text-sm", active && "font-semibold text-accent")}>
                            {p.name}
                          </span>
                          <span className="hidden shrink-0 rounded bg-foreground/[0.05] px-1.5 py-0.5 text-[10px] text-muted sm:inline">
                            {p.topic}
                          </span>
                          <LevelPixels level={p.level} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ListDrawerIcon() {
  return (
    <svg aria-hidden fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 16 16" width="13">
      <path d="M2.5 4h11M2.5 8h11M2.5 12h7.5" />
    </svg>
  );
}
