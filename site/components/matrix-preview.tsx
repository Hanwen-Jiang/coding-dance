"use client";

/**
 * 首页进度格子的预览：桌面上鼠标停在格子上 300 毫秒（或者键盘移到格子上）浮出一张小卡片，
 * 写着题号、题名、难度、专题、重要程度、状态和题面的头一两句；题面用到时才去读（和题目页共用缓存，点进去不用再等）。
 * 手机上第一下点格子只打开预览，点预览里的「去做题」或者再点一下同一格才进题目页；桌面上点格子照旧直接进。
 * 100 个格子共用一张卡片（不是每格一个弹层）。
 */
import clsx from "clsx";
import NextLink from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { LevelPixels, Skel, StatusPixel } from "@/components/pixel";
import { TierChip, TopicChip } from "@/components/tags";
import type { Problem, ProblemDetail } from "@/lib/types";
import { fetchApi } from "@/lib/use-api";

const OPEN_DELAY = 300;
const CLOSE_DELAY = 160;
const WIDTH = 300;

/** 题面开头的一两句（「示例」之前，去掉代码块、图片和表格），最多 120 字。力扣的题面有的用 <p>、有的用 <div>，所以按整段文字截 */
const excerpts = new Map<number, string>();
function excerptOf(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("pre, img, figure, table, svg").forEach((n) => n.remove());
  let text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  const cut = text.search(/示例\s*\d|示例\s*[:：]|提示\s*[:：]|进阶\s*[:：]/);
  if (cut > 0) text = text.slice(0, cut).trim();
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}

type Open = { p: Problem; rect: DOMRect; touch: boolean };

export function useMatrixPreview() {
  const [open, setOpen] = useState<Open | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<string>("mouse");
  const clear = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const later = useCallback((fn: () => void, ms: number) => { clear(); timer.current = setTimeout(fn, ms); }, [clear]);
  const hide = useCallback(() => later(() => setOpen(null), CLOSE_DELAY), [later]);

  // 滚动、改窗口大小、按 Esc、点到别处都收起
  useEffect(() => {
    if (!open) return;
    const close = () => { clear(); setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onDown = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.("[data-matrix-preview], .matrix-cell")) close(); };
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, clear]);
  useEffect(() => clear, [clear]);

  const cellProps = (p: Problem): Partial<React.ComponentProps<typeof NextLink>> => ({
    onPointerDown: (e) => { pointer.current = e.pointerType; },
    onPointerEnter: (e) => {
      if (e.pointerType !== "mouse") return;
      const el = e.currentTarget;
      later(() => setOpen({ p, rect: el.getBoundingClientRect(), touch: false }), OPEN_DELAY);
    },
    onPointerLeave: (e) => { if (e.pointerType === "mouse") hide(); },
    onFocus: (e) => {
      if (pointer.current !== "mouse" && pointer.current !== "keyboard") return; // 触屏点下去也会聚焦，由 onClick 处理
      const el = e.currentTarget;
      later(() => setOpen({ p, rect: el.getBoundingClientRect(), touch: false }), OPEN_DELAY);
    },
    onBlur: () => hide(),
    onKeyDown: () => { pointer.current = "keyboard"; },
    onClick: (e) => {
      if (pointer.current === "mouse" || pointer.current === "keyboard") return; // 桌面上点格子直接进题目页
      if (open?.p.id === p.id) return; // 预览已经开着，再点一下进去
      e.preventDefault();
      clear();
      setOpen({ p, rect: e.currentTarget.getBoundingClientRect(), touch: true });
    },
  });

  const layer = open ? createPortal(<PreviewCard key={open.p.id} open={open} onEnter={clear} onLeave={hide} />, document.body) : null;
  return { cellProps, layer };
}

function PreviewCard({ open, onEnter, onLeave }: { open: Open; onEnter: () => void; onLeave: () => void }) {
  const { p, rect, touch } = open;
  const [excerpt, setExcerpt] = useState<string | null>(() => excerpts.get(p.id) ?? null);
  const [failed, setFailed] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (excerpts.has(p.id)) return;
    let alive = true;
    fetchApi<ProblemDetail>(`/api/problem/${p.id}`)
      .then((d) => { const t = excerptOf(d.statementHtml || ""); excerpts.set(p.id, t); if (alive) setExcerpt(t); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [p.id]);

  // 放在格子下面；下面放不下就放上面；左右不出屏幕
  useLayoutEffect(() => {
    const h = card.current?.offsetHeight ?? 160, vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - 32);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), vw - 16 - width);
    const below = rect.bottom + 8;
    const top = below + h > vh - 8 && rect.top - 8 - h > 8 ? rect.top - 8 - h : below;
    setPos({ left, top });
  }, [rect, excerpt]);

  return (
    <div
      aria-label={`第 ${p.id} 题预览`}
      className={clsx("tour-pop fixed z-[90] flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4 shadow-surface", !pos && "invisible")}
      data-matrix-preview
      onPointerEnter={(e) => { if (e.pointerType === "mouse") onEnter(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") onLeave(); }}
      ref={card}
      role="dialog"
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: Math.min(WIDTH, typeof window === "undefined" ? WIDTH : window.innerWidth - 32) }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted">{p.id}.</span>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-5">{p.name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <LevelPixels level={p.level} />
        <TopicChip topic={p.topic} />
        <TierChip tier={p.tier} />
        <StatusPixel status={p.status} />
      </div>
      {excerpt != null ? (
        excerpt && <p className="line-clamp-3 text-xs leading-5 text-muted">{excerpt}</p>
      ) : failed ? null : (
        <span aria-hidden className="flex flex-col gap-1.5"><Skel className="h-3 w-full" /><Skel className="h-3 w-4/5" /></span>
      )}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-[11px] text-muted">{touch ? "再点一下格子也能进" : "点格子直接进入"}</span>
        <NextLink className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2" href={`/p/${p.id}/`}>
          去做题 →
        </NextLink>
      </div>
    </div>
  );
}
