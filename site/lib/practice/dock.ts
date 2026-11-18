"use client";

/**
 * 桌面（≥1200）题目页右侧的练习区展开还是收起：默认收起（右边一个像素把手，第一次来时自己跳几下提示这里能写代码），
 * 用户展开、收起过就记在浏览器里，换题、刷新都不变。
 * 状态写在 <html data-practice> 上（样式全靠它，见 practice.css；layout.tsx 在首屏前就按存的值设好，避免先按默认画再跳）。
 * 练习区（components/practice/workbench.tsx）改它，题目页（components/problem-view.tsx）跟着它换布局：
 * 展开时是「写代码」的布局（提示、动画、题解这些收成一排入口，用到时再弹出来），收起时是从上往下读的布局。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export const DOCK_KEY = "hot100:practice:dock";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const read = () => document.documentElement.dataset.practice === "open";
/** 用户自己展开过一次练习区：以后不再用把手的动画提示 */
export const DISCOVERED_KEY = "hot100:practice:discovered";

export function setPracticeDocked(open: boolean) {
  document.documentElement.dataset.practice = open ? "open" : "closed";
  try {
    localStorage.setItem(DOCK_KEY, open ? "open" : "closed");
    if (open) localStorage.setItem(DISCOVERED_KEY, "1");
  } catch { /* 这次仍然生效 */ }
  listeners.forEach((fn) => fn());
}

/** 练习区是不是展开着（服务端渲染时当作收起，和默认一致） */
export function usePracticeDocked() {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** 现在是不是「写代码」的布局：桌面并排、练习区展开着 */
export function useCodingLayout() {
  const docked = usePracticeDocked();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1200px)"), update = () => setDesktop(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  return desktop && docked;
}

/** 练习区用：[是否展开, 设置] */
export function usePracticeDock() {
  const docked = usePracticeDocked();
  const set = useCallback((open: boolean) => setPracticeDocked(open), []);
  return [docked, set] as const;
}
