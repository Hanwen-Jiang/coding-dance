// 演示步骤的动态过渡特效（在 morphInto 之后执行，也支持点「重播本步」单独重播）：
//   1. 重触发 CSS 关键帧动画（数值改动弹跳、边绘制、旧指针剪断、树节点交换脉冲）；
//   2. 数组 / 柱状图的双向交换弧线 + 数值飞跃胶囊（data-swaps）；
//   3. DP 网格 / 数组的依赖传递箭头（data-feeds）。

type FeedItem = {
  from: [number, number] | number;
  to: [number, number] | number;
  label?: string;
  win?: boolean;
};

let fxUid = 0;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function makeSvg(w: number, h: number): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "dm-fx-overlay");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

function addMarker(svg: SVGSVGElement, id: string, cls: string) {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", id);
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "7");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M0 0L8 4L0 8z");
  path.setAttribute("class", cls);
  marker.appendChild(path);
  defs.appendChild(marker);
  svg.appendChild(defs);
}

function centerIn(el: Element, wrap: Element): { x: number; y: number; w: number; h: number } {
  const er = el.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  return {
    x: er.left - wr.left + wrap.scrollLeft + er.width / 2,
    y: er.top - wr.top + wrap.scrollTop + er.height / 2,
    w: er.width,
    h: er.height,
  };
}

function runSwaps(scroll: HTMLElement, arr: HTMLElement, swaps: [number, number][], reduce: boolean) {
  if (!swaps.length) return;
  const w = Math.max(scroll.scrollWidth, scroll.clientWidth);
  const h = Math.max(scroll.scrollHeight, scroll.clientHeight);
  if (w <= 0 || h <= 0) return;

  const svg = makeSvg(w, h);
  const mid = `dmfxsw${fxUid++}`;
  addMarker(svg, mid, "dm-fx-ah");

  for (const [i, j] of swaps) {
    if (i === j) continue;
    const aEl = arr.querySelector<HTMLElement>(`[data-idx="${i}"]`);
    const bEl = arr.querySelector<HTMLElement>(`[data-idx="${j}"]`);
    if (!aEl || !bEl) continue;

    const ca = centerIn(aEl, scroll);
    const cb = centerIn(bEl, scroll);
    const dist = Math.abs(cb.x - ca.x);
    const lift = Math.min(34, 14 + dist * 0.14);

    // 双向弯弧线：上方从 a -> b，下方从 b -> a
    const topY = Math.min(ca.y - ca.h / 2, cb.y - cb.h / 2) + 2;
    const ctrlTopY = Math.max(4, topY - lift);
    const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute("class", "dm-fx-swap-arc");
    p1.setAttribute("marker-end", `url(#${mid})`);
    p1.setAttribute("d", `M${ca.x} ${topY} Q${(ca.x + cb.x) / 2} ${ctrlTopY} ${cb.x} ${topY}`);
    svg.appendChild(p1);

    if (!reduce && typeof HTMLElement.prototype.animate === "function") {
      // 飞跃标签：显示换过去的值和换过来的值
      const valNowAtI = aEl.getAttribute("data-val") ?? aEl.textContent ?? "";
      const valNowAtJ = bEl.getAttribute("data-val") ?? bEl.textContent ?? "";
      // 当前数组已经交换完毕，所以原来在 i 的值现在在 j，原来在 j 的值现在在 i
      const pairs: [string, number, number, number][] = [
        [valNowAtJ, ca.x, cb.x, -lift],
        [valNowAtI, cb.x, ca.x, lift * 0.65],
      ];
      for (const [txt, x0, x1, dy] of pairs) {
        if (!txt) continue;
        const chip = document.createElement("span");
        chip.className = "dm-fly-chip";
        chip.textContent = txt;
        chip.style.left = `${x0}px`;
        chip.style.top = `${ca.y}px`;
        scroll.appendChild(chip);
        const anim = chip.animate(
          [
            { transform: "translate(-50%, -50%) scale(0.9)", opacity: 0.95 },
            { transform: `translate(calc(-50% + ${(x1 - x0) / 2}px), calc(-50% + ${dy}px)) scale(1.06)`, opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${x1 - x0}px), -50%) scale(0.92)`, opacity: 0 },
          ],
          { duration: 640, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
        );
        anim.onfinish = () => chip.remove();
      }
    }
  }

  if (svg.childNodes.length > 1) scroll.appendChild(svg);
}

function runFeeds(scroll: HTMLElement, root: HTMLElement, feeds: FeedItem[], reduce: boolean) {
  if (!feeds.length) return;
  const w = Math.max(scroll.scrollWidth, scroll.clientWidth);
  const h = Math.max(scroll.scrollHeight, scroll.clientHeight);
  if (w <= 0 || h <= 0) return;

  const svg = makeSvg(w, h);
  const winId = `dmfxwin${fxUid++}`;
  const candId = `dmfxcand${fxUid++}`;
  addMarker(svg, winId, "dm-fx-ah-win");
  addMarker(svg, candId, "dm-fx-ah-cand");

  const findCell = (pos: [number, number] | number) =>
    Array.isArray(pos)
      ? root.querySelector<HTMLElement>(`[data-rc="${pos[0]},${pos[1]}"]`)
      : root.querySelector<HTMLElement>(`[data-idx="${pos}"]`);

  for (const f of feeds) {
    const fromEl = findCell(f.from);
    const toEl = findCell(f.to);
    if (!fromEl || !toEl) continue;

    const a = centerIn(fromEl, scroll);
    const b = centerIn(toEl, scroll);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sx = a.x + ux * Math.min(12, a.w * 0.28);
    const sy = a.y + uy * Math.min(12, a.h * 0.28);
    const ex = b.x - ux * Math.min(16, b.w * 0.34);
    const ey = b.y - uy * Math.min(16, b.h * 0.34);

    // 同一行且跨多列时稍微往上拱一点，避免压住中间格子文字
    const isLongRow = Math.abs(dy) < 4 && Math.abs(dx) > 54;
    const bend = isLongRow ? -Math.min(26, Math.abs(dx) * 0.2) : 0;
    const cx = (sx + ex) / 2;
    const cy = (sy + ey) / 2 + bend;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `dm-fx-feed ${f.win ? "win" : "cand"}${reduce ? " no-anim" : ""}`);
    path.setAttribute("marker-end", `url(#${f.win ? winId : candId})`);
    path.setAttribute("d", bend ? `M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}` : `M${sx} ${sy} L${ex} ${ey}`);
    svg.appendChild(path);

    if (f.label) {
      const lx = cx;
      const ly = bend ? cy + bend * 0.15 : cy - (Math.abs(dx) < 6 ? 0 : 8);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", `dm-fx-tag ${f.win ? "win" : "cand"}`);
      text.setAttribute("x", String(lx));
      text.setAttribute("y", String(ly));
      text.textContent = f.label;
      svg.appendChild(text);
    }
  }

  if (svg.childNodes.length > 2) scroll.appendChild(svg);
}

/** 在 morphInto 之后执行当前步骤的动态动画；也可由「重播本步」重复触发 */
export function playDemoFx(container: HTMLElement | null) {
  if (!container) return;

  container.querySelectorAll(".dm-fx-overlay, .dm-fly-chip").forEach((el) => el.remove());

  const reduce = reducedMotion();
  container.classList.remove("dm-fx-run");
  if (!reduce) {
    // 强制重排以重播 CSS 关键帧动画
    void container.offsetWidth;
    container.classList.add("dm-fx-run");
  }

  container.querySelectorAll<HTMLElement>("[data-swaps]").forEach((el) => {
    const scroll = el.closest<HTMLElement>(".dm-scroll");
    if (!scroll) return;
    try {
      const swaps = JSON.parse(el.getAttribute("data-swaps") || "[]") as [number, number][];
      runSwaps(scroll, el, swaps, reduce);
    } catch { /* 忽略格式异常 */ }
  });

  container.querySelectorAll<HTMLElement>("[data-feeds]").forEach((el) => {
    const scroll = el.closest<HTMLElement>(".dm-scroll");
    if (!scroll) return;
    try {
      const feeds = JSON.parse(el.getAttribute("data-feeds") || "[]") as FeedItem[];
      runFeeds(scroll, el, feeds, reduce);
    } catch { /* 忽略格式异常 */ }
  });
}
