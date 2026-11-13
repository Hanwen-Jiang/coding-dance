import { Chip } from "@heroui/react";
import clsx from "clsx";

import type { Level, Status, Tier } from "@/lib/types";

const LEVEL_COLOR = { 简单: "success", 中等: "warning", 困难: "danger" } as const;

export function LevelChip({ level, size = "sm" }: { level: Level; size?: "sm" | "md" }) {
  return (
    <Chip color={LEVEL_COLOR[level]} size={size} variant="soft">
      {level}
    </Chip>
  );
}

const TIER_STYLE: Record<Tier, { color: "accent" | "default" | "warning" | "success" | "danger"; variant: "primary" | "soft" | "secondary" }> = {
  P0: { color: "accent", variant: "primary" },
  P1: { color: "accent", variant: "soft" },
  P2: { color: "default", variant: "secondary" },
  复习: { color: "warning", variant: "soft" },
  已通过: { color: "success", variant: "soft" },
  困难: { color: "danger", variant: "soft" },
};

export function TierChip({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "md" }) {
  if (tier === "已通过") return null; // 和状态重复，不再单独显示
  const s = TIER_STYLE[tier];
  return (
    <Chip color={s.color} size={size} variant={s.variant}>
      {tier}
    </Chip>
  );
}

export function TopicChip({ topic, size = "sm" }: { topic: string; size?: "sm" | "md" }) {
  return (
    <Chip size={size} variant="secondary">
      {topic}
    </Chip>
  );
}

const STATUS_DOT: Record<Status, string> = {
  已通过: "bg-success",
  曾通过: "bg-warning",
  未开始: "bg-default-foreground/25 dark:bg-white/25",
};

export function StatusDot({ status, withLabel = true, className }: { status: Status; withLabel?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <span aria-hidden className={clsx("size-2 rounded-full", STATUS_DOT[status])} />
      {withLabel ? status : <span className="sr-only">{status}</span>}
    </span>
  );
}

const LANG_SHORT: Record<string, string> = { java: "Java", python: "Py", go: "Go" };
export const langShort = (l: string) => LANG_SHORT[l] ?? l;
