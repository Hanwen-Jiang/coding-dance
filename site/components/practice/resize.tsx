"use client";

// 拖动条：调整两块区域的比例（题面 ↔ 代码、编辑器 ↔ 控制台）。鼠标、触屏、键盘方向键都能用，双击恢复默认，调好的比例存在浏览器里。
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 存在浏览器里的比例（0~1）；读不到时用默认值 */
export function useStoredFraction(key: string, fallback: number, min: number, max: number) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    try { const v = Number(localStorage.getItem(key)); if (v >= min && v <= max) setValue(v); } catch { /* 用默认值 */ }
  }, [key, min, max]);
  const commit = useCallback((v: number) => { try { localStorage.setItem(key, String(Math.round(v * 1000) / 1000)); } catch { /* 这次仍然生效 */ } }, [key]);
  return [value, setValue, commit] as const;
}

/** 当前是否满足某个媒体查询（首屏按 false 渲染，挂载后更新） */
export function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query), update = () => setMatch(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, [query]);
  return match;
}

/**
 * axis="x"：竖着的一条，左右拖；axis="y"：横着的一条，上下拖。
 * value 是「被调整那一块」占容器的比例；invert=true 表示那一块在拖动条后面（往下拖它变小）。
 * container() 返回用来换算比例的容器。
 * collapseBelow + onCollapse：拖到比 collapseBelow 还小（已经越过最小值一段）时整块收起来，像 VS Code 的侧栏那样；
 * 这次拖动就此结束，比例保持拖到最小值之前的样子，展开时还是原来的宽度。
 */
export function ResizeHandle({ axis, value, min, max, fallback, invert = false, label, container, onChange, onCommit, className, hidden, collapseBelow, onCollapse }: {
  axis: "x" | "y";
  value: number;
  min: number;
  max: number;
  fallback: number;
  invert?: boolean;
  label: string;
  container: () => HTMLElement | null;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  className?: string;
  hidden?: boolean;
  collapseBelow?: number;
  onCollapse?: () => void;
}) {
  const drag = useRef<{ start: number; from: number; size: number; last: number; collapsed?: boolean } | null>(null);
  const [active, setActive] = useState(false);
  const set = (v: number) => { const next = clamp(v, min, max); onChange(next); return next; };
  const coordinate = (e: React.PointerEvent) => (axis === "x" ? e.clientX : e.clientY);

  return (
    <div
      aria-label={label}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-valuemax={Math.round(max * 100)}
      aria-valuemin={Math.round(min * 100)}
      aria-valuenow={Math.round(value * 100)}
      className={clsx("practice-resize-handle", `practice-resize-handle--${axis}`, active && "practice-resize-handle--active", className)}
      hidden={hidden}
      onDoubleClick={() => onCommit(set(fallback))}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.03, sign = invert ? -1 : 1;
        const back = axis === "x" ? "ArrowLeft" : "ArrowUp", forward = axis === "x" ? "ArrowRight" : "ArrowDown";
        let next: number | null = null;
        if (e.key === back) next = value - step * sign;
        else if (e.key === forward) next = value + step * sign;
        else if (e.key === "Home") next = min;
        else if (e.key === "End") next = max;
        if (next === null) return;
        e.preventDefault();
        onCommit(set(next));
      }}
      onLostPointerCapture={() => { if (drag.current && !drag.current.collapsed) onCommit(drag.current.last); drag.current = null; setActive(false); }}
      onPointerDown={(e) => {
        const box = container()?.getBoundingClientRect();
        if (!box || e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { start: coordinate(e), from: value, size: axis === "x" ? box.width : box.height, last: value };
        setActive(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !d.size) return;
        const delta = (coordinate(e) - d.start) / d.size;
        const raw = d.from + (invert ? -delta : delta);
        if (collapseBelow != null && onCollapse && raw < collapseBelow) {
          // 越过最小值一段：收起来，这次拖动到此为止（宽度留在拖之前，展开时还是原来那样）
          d.collapsed = true;
          onChange(d.from);
          onCommit(d.from);
          e.currentTarget.releasePointerCapture(e.pointerId);
          onCollapse();
          return;
        }
        d.last = set(raw);
      }}
      role="separator"
      tabIndex={0}
      title="拖动调整大小，双击恢复默认"
    >
      <span aria-hidden className="practice-resize-grip" />
    </div>
  );
}
