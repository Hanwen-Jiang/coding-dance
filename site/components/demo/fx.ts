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

type TreeMorphData = {
  R: number;
  directed: boolean;
  lrLabels: boolean;
  from: Record<string, [number, number]>;
  to: Record<string, [number, number]>;
};

let fxUid = 0;
const activeRafs = new WeakMap<HTMLElement, number[]>();

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
  marker.setAttribute("markerUnits", "userSpaceOnUse");
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "6");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
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
    const aAnchor = aEl.querySelector<HTMLElement>(".dm-bar") || aEl;
    const bAnchor = bEl.querySelector<HTMLElement>(".dm-bar") || bEl;
    const ac = centerIn(aAnchor, scroll);
    const bc = centerIn(bAnchor, scroll);
    const dist = Math.abs(cb.x - ca.x);
    const lift = Math.min(28, 12 + dist * 0.08);

    // 弧线从格子/柱槽顶部上方 4px 起跳，贴合预留的 36px 顶部轨道，绝不压住数字与边框
    const topY = Math.max(18, Math.min(ca.y - ca.h / 2, cb.y - cb.h / 2) - 4);
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
      const startY = aEl === aAnchor ? ca.y : ac.y;
      const peakUp = Math.min(lift, Math.max(14, startY - 12));
      // 当前数组已经交换完毕，所以原来在 i 的值现在在 j，原来在 j 的值现在在 i
      const pairs: [string, number, number, number, number][] = [
        [valNowAtJ, ca.x, cb.x, -peakUp, ac.y],
        [valNowAtI, cb.x, ca.x, Math.min(22, lift * 0.6), bc.y],
      ];
      for (const [txt, x0, x1, dy, sy0] of pairs) {
        if (!txt) continue;
        const chip = document.createElement("span");
        chip.className = "dm-fly-chip";
        chip.textContent = txt;
        chip.style.left = `${x0}px`;
        chip.style.top = `${sy0}px`;
        scroll.appendChild(chip);
        const anim = chip.animate(
          [
            { transform: "translate(-50%, -50%) scale(0.9)", opacity: 0.95 },
            { transform: `translate(calc(-50% + ${(x1 - x0) / 2}px), calc(-50% + ${dy}px)) scale(1.05)`, opacity: 1, offset: 0.5 },
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

  const isArr = root.classList.contains("dm-arr");
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

    if (isArr) {
      // 1D 数组：沿预留顶部轨道画平滑弧线，避免穿过格内数字
      const sx = a.x, sy = Math.max(16, a.y - a.h / 2 - 4);
      const ex = b.x, ey = Math.max(16, b.y - b.h / 2 - 4);
      const ctrlY = Math.max(5, Math.min(sy, ey) - 22);
      const cx = (sx + ex) / 2;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", `dm-fx-feed ${f.win ? "win" : "cand"}${reduce ? " no-anim" : ""}`);
      path.setAttribute("marker-end", `url(#${f.win ? winId : candId})`);
      path.setAttribute("d", `M${sx} ${sy} Q${cx} ${ctrlY} ${ex} ${ey}`);
      svg.appendChild(path);
      if (f.label && (f.win || feeds.length === 1)) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("class", `dm-fx-tag ${f.win ? "win" : "cand"}`);
        text.setAttribute("x", String(cx));
        text.setAttribute("y", String(ctrlY + 3));
        text.textContent = f.label;
        svg.appendChild(text);
      }
      continue;
    }

    // 2D 网格：起止精确落在格子外边缘（严格走格子之间的 16px 缝隙，不压格内数字）
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tA = Math.min(Math.abs(ux) > 1e-4 ? (a.w / 2) / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-4 ? (a.h / 2) / Math.abs(uy) : Infinity);
    const tB = Math.min(Math.abs(ux) > 1e-4 ? (b.w / 2) / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-4 ? (b.h / 2) / Math.abs(uy) : Infinity);
    const sx = a.x + ux * (tA + 1.5);
    const sy = a.y + uy * (tA + 1.5);
    const ex = b.x - ux * (tB + 2);
    const ey = b.y - uy * (tB + 2);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `dm-fx-feed ${f.win ? "win" : "cand"}${reduce ? " no-anim" : ""}`);
    path.setAttribute("marker-end", `url(#${f.win ? winId : candId})`);
    path.setAttribute("d", `M${sx} ${sy} L${ex} ${ey}`);
    svg.appendChild(path);

    // 只在胜出路径（或唯一路径）上标注简洁标签，防止 3 个候选文字挤在同一条缝隙里互遮
    if (f.label && (f.win || feeds.length === 1)) {
      const mx = (sx + ex) / 2;
      const my = (sy + ey) / 2;
      const isVert = Math.abs(dx) < 6;
      const isDiag = Math.abs(dx) >= 6 && Math.abs(dy) >= 6;
      const lx = mx + (isVert ? 14 : 0);
      const ly = my + (isVert || isDiag ? 0 : -11);
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

function runTreeMorph(container: HTMLElement, svg: SVGSVGElement, data: TreeMorphData, reduce: boolean) {
  if (reduce) return;
  const { R, directed, from, to } = data;
  const nodes = new Map<string, HTMLElement>();
  svg.querySelectorAll<HTMLElement>(".dm-tnode[data-key]").forEach((el) => {
    const k = el.getAttribute("data-key") || "";
    if (k.startsWith("tn-")) {
      el.style.transition = "none";
      nodes.set(k.slice(3), el);
    }
  });
  const lines = Array.from(svg.querySelectorAll<SVGLineElement>("line[data-from][data-to]"));
  const lrTexts = Array.from(svg.querySelectorAll<SVGTextElement>("text.dm-lr[data-efrom][data-eto]"));

  const ids = Object.keys(to);
  const lerpPos = (t: number) => {
    const cur: Record<string, [number, number]> = {};
    for (const id of ids) {
      const a = from[id] || to[id];
      const b = to[id];
      cur[id] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    return cur;
  };

  const applyFrame = (pMap: Record<string, [number, number]>) => {
    for (const id of ids) {
      const el = nodes.get(id);
      const p = pMap[id];
      if (el && p) el.style.transform = `translate(${p[0]}px,${p[1]}px)`;
    }
    for (const line of lines) {
      const fid = line.getAttribute("data-from") || "";
      const tid = line.getAttribute("data-to") || "";
      const p1 = pMap[fid], p2 = pMap[tid];
      if (!p1 || !p2) continue;
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      line.setAttribute("x1", String(p1[0] + ux * R));
      line.setAttribute("y1", String(p1[1] + uy * R));
      line.setAttribute("x2", String(p2[0] - ux * (directed ? R + 3 : R)));
      line.setAttribute("y2", String(p2[1] - uy * (directed ? R + 3 : R)));
    }
    for (const lbl of lrTexts) {
      const fid = lbl.getAttribute("data-efrom") || "";
      const tid = lbl.getAttribute("data-eto") || "";
      const side = lbl.getAttribute("data-eside") || "L";
      const p1 = pMap[fid], p2 = pMap[tid];
      if (!p1 || !p2) continue;
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const sx = p1[0] + ux * R, sy = p1[1] + uy * R;
      const ex = p2[0] - ux * (directed ? R + 3 : R), ey = p2[1] - uy * (directed ? R + 3 : R);
      const sgn = side === "L" ? 1 : -1;
      lbl.setAttribute("x", String((sx + ex) / 2 - uy * sgn * 10));
      lbl.setAttribute("y", String((sy + ey) / 2 + ux * sgn * 10));
    }
  };

  // 先在原位停顿 120ms 看清变形前位置，再 800ms 平滑展开，节点和边同步移动
  applyFrame(lerpPos(0));
  const HOLD = 120;
  const DUR = 800;
  const t0 = performance.now();
  const list = activeRafs.get(container) || [];
  const step = (now: number) => {
    const elapsed = now - t0;
    if (elapsed < HOLD) {
      list.push(requestAnimationFrame(step));
      return;
    }
    const raw = Math.min(1, (elapsed - HOLD) / DUR);
    const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    applyFrame(lerpPos(eased));
    if (raw < 1) {
      list.push(requestAnimationFrame(step));
    } else {
      applyFrame(to);
      nodes.forEach((el) => { el.style.transition = ""; });
    }
  };
  list.push(requestAnimationFrame(step));
  activeRafs.set(container, list);
}

/** 在 morphInto 之后执行当前步骤的动态动画；也可由「重播本步」重复触发 */
export function playDemoFx(container: HTMLElement | null) {
  if (!container) return;

  for (const id of activeRafs.get(container) || []) cancelAnimationFrame(id);
  activeRafs.delete(container);
  container.querySelectorAll(".dm-fx-overlay, .dm-fly-chip").forEach((el) => el.remove());

  const reduce = reducedMotion();
  container.classList.remove("dm-fx-run");
  if (!reduce) {
    // 强制重排以重播 CSS 关键帧动画
    void container.offsetWidth;
    container.classList.add("dm-fx-run");
  }

  container.querySelectorAll<SVGSVGElement>("svg[data-morph]").forEach((svg) => {
    try {
      const data = JSON.parse(svg.getAttribute("data-morph") || "{}") as TreeMorphData;
      if (data?.from && data?.to) runTreeMorph(container, svg, data, reduce);
    } catch { /* 忽略格式异常 */ }
  });

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
