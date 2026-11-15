"use client";

// 浮在页面右边、不占位置的滚动条。鼠标设备上原生的页面滚动条被藏掉了（styles/globals.css），这里补一个：
// 滚动时出现，停一会儿淡出；鼠标移到右边缘会出现并变粗，可以拖动，点轨道翻一页。
// 触屏设备不显示，用系统自己的浮动滚动条。
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

export function OverlayScrollbar() {
  const [fine, setFine] = useState(false);
  const [m, setM] = useState({ top: 0, size: 0 });
  const [awake, setAwake] = useState(false);
  const [hover, setHover] = useState(false);
  const [drag, setDrag] = useState(false);
  const timer = useRef(0);
  const from = useRef({ y: 0, scroll: 0 });

  const measure = useCallback(() => {
    const vh = window.innerHeight, sh = document.documentElement.scrollHeight;
    if (sh <= vh + 1) { setM({ top: 0, size: 0 }); return; }
    const size = Math.max(36, (vh * vh) / sh);
    setM({ top: (window.scrollY / (sh - vh)) * (vh - size), size });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const set = () => setFine(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  useEffect(() => {
    if (!fine) return;
    const onScroll = () => {
      measure();
      setAwake(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setAwake(false), 1000);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      window.clearTimeout(timer.current);
    };
  }, [fine, measure]);

  if (!fine || !m.size) return null;
  // 滑块每移动 1px，页面滚动多少
  const ratio = () => (document.documentElement.scrollHeight - window.innerHeight) / (window.innerHeight - m.size);
  const thumbDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    from.current = { y: e.clientY, scroll: window.scrollY };
    setDrag(true);
  };
  const thumbMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag) window.scrollTo({ top: from.current.scroll + (e.clientY - from.current.y) * ratio(), behavior: "instant" });
  };
  const thumbUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDrag(false);
  };
  // 点轨道：往那边翻一页
  const trackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    window.scrollBy({ top: (e.clientY < m.top ? -1 : 1) * window.innerHeight * 0.9, behavior: "smooth" });
  };
  const show = awake || hover || drag;

  return (
    <div
      aria-hidden
      className="fixed top-0 right-0 z-[55] h-dvh w-3"
      onPointerDown={trackDown}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div
        className={clsx(
          "absolute right-0.5 rounded-full transition-[opacity,width,background-color] duration-200",
          show ? "opacity-100" : "opacity-0",
          hover || drag ? "w-2 bg-foreground/45" : "w-1.5 bg-foreground/30",
        )}
        style={{ top: m.top, height: m.size }}
        onPointerCancel={thumbUp}
        onPointerDown={thumbDown}
        onPointerMove={thumbMove}
        onPointerUp={thumbUp}
      />
    </div>
  );
}
