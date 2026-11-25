// 把演示的一步（views）渲染成 HTML。移植自 tools/illustrations/engine.js，
// 只是类名都加了 dm- 前缀、颜色角色改成 r-*，避免和 HeroUI / Tailwind 的类名冲突。

/* eslint-disable @typescript-eslint/no-explicit-any */
type Item = { v?: unknown; prev?: unknown; cls?: string; water?: number; hide?: boolean; ecls?: string; noNil?: boolean; key?: string | number };
type View = Record<string, any>;

const E = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const INV = new Set(["a", "b", "c"]);
const roles = (cls?: string) => (cls || "").split(/\s+/).filter(Boolean).map((t) => "r-" + t).join(" ");
const first = (cls?: string) => (cls || "").split(" ")[0];
const lab = (v: View) => (v.label ? `<div class="dm-vl">${v.label}</div>` : "");
const norm = (it: unknown): Item => (it !== null && typeof it === "object" ? (it as Item) : { v: it });
const show = (x: unknown) => (x === null || x === undefined ? "" : E(x));

function ptrMap(ptrs?: Record<string, string | number | null | undefined>) {
  const m: Record<string, string[]> = {};
  for (const [name, i] of Object.entries(ptrs || {})) {
    if (i !== null && i !== undefined) (m[String(i)] = m[String(i)] || []).push(name);
  }
  return m;
}

/** 渲染单个格子的内容：如有 prev 且不等于当前值，展示 old→new 过渡 */
function cellBody(it: Item): { changed: boolean; html: string } {
  if (it.prev !== undefined && String(it.prev) !== String(it.v)) {
    return {
      changed: true,
      html: `<span class="dm-prev">${show(it.prev)}→</span><span class="dm-val">${show(it.v)}</span>`,
    };
  }
  return { changed: false, html: show(it.v) };
}

/** 下标那一行写什么：labels 可以逐个指定（比如越界的格子写 -1），否则从 idxFrom（默认 0）开始数 */
const idxLabel = (v: View, i: number) => (v.labels ? show(v.labels[i]) : v.idxFrom ? i + v.idxFrom : i);

function swapClassMap(swaps?: [number, number][]) {
  const m = new Map<number, string>();
  for (const [a, b] of swaps || []) {
    if (a !== b) {
      m.set(a, "dm-swap-a");
      m.set(b, "dm-swap-b");
    }
  }
  return m;
}

function vArray(v: View) {
  const pm = ptrMap(v.ptrs), hasP = v.ptrs !== undefined;
  const hasSwapsProp = Array.isArray(v.swaps), hasFeedsProp = Array.isArray(v.feeds);
  const swaps = hasSwapsProp ? (v.swaps as [number, number][]) : undefined;
  const sw = swapClassMap(swaps);
  const feeds = hasFeedsProp ? v.feeds : undefined;
  const attrs = `${swaps?.length ? ` data-swaps="${E(JSON.stringify(swaps))}"` : ""}${feeds?.length ? ` data-feeds="${E(JSON.stringify(feeds))}"` : ""}`;
  const scrollCls = hasSwapsProp || hasFeedsProp ? "dm-scroll dm-pad-top" : "dm-scroll";
  const cols = (v.items as unknown[]).map(norm).map((it, i) => {
    const body = cellBody(it);
    const sc = sw.get(i) || "";
    return `<div class="dm-cc"><div class="dm-cell ${roles(it.cls)}${body.changed ? " dm-changed" : ""}${sc ? ` ${sc}` : ""}" data-idx="${i}" data-val="${show(it.v)}">${body.html}</div>` +
      (v.idx === false ? "" : `<div class="dm-ci">${idxLabel(v, i)}</div>`) +
      (hasP ? `<div class="dm-cp">${(pm[String(i)] || []).map((n) => `<span>${E(n)}</span>`).join("")}</div>` : "") + `</div>`;
  }).join("");
  return `<div class="dm-v">${lab(v)}<div class="${scrollCls}"><div class="dm-arr"${attrs}>${cols}</div></div></div>`;
}

function vBars(v: View) {
  const items = (v.items as unknown[]).map(norm), pm = ptrMap(v.ptrs);
  const hasSwapsProp = Array.isArray(v.swaps);
  const swaps = hasSwapsProp ? (v.swaps as [number, number][]) : undefined;
  const sw = swapClassMap(swaps);
  const max = Math.max(1, ...items.map((it) => Number(it.v) + (it.water || 0)), v.max || 0);
  const attrs = swaps?.length ? ` data-swaps="${E(JSON.stringify(swaps))}"` : "";
  const scrollCls = hasSwapsProp ? "dm-scroll dm-pad-top" : "dm-scroll";
  const cols = items.map((it, i) => {
    const val = Number(it.v), small = val / max < 0.16;
    const sc = sw.get(i) || "";
    const changed = it.prev !== undefined && String(it.prev) !== String(it.v);
    return `<div class="dm-cc"><div class="dm-bar-slot" data-idx="${i}" data-val="${show(it.v)}">` +
      (small ? `<div class="dm-bv">${show(it.v)}</div>` : "") +
      (it.water ? `<div class="dm-wat" style="height:${(it.water / max) * 100}%"></div>` : "") +
      `<div class="dm-bar ${roles(it.cls)}${changed ? " dm-changed" : ""}${sc ? ` ${sc}` : ""}" style="height:${(val / max) * 100}%">${small ? "" : show(it.v)}</div></div>` +
      `<div class="dm-ci">${i}</div><div class="dm-cp">${(pm[String(i)] || []).map((n) => `<span>${E(n)}</span>`).join("")}</div></div>`;
  }).join("");
  return `<div class="dm-v">${lab(v)}<div class="${scrollCls}"><div class="dm-arr"${attrs}>${cols}</div></div></div>`;
}

/** 网格：rowLabels / colLabels 可以替代行列号（越界的那一行写 -1），ax: false 不画行列号；支持 feeds 传递箭头、swaps 二维交换弧线与 prev 前后值 */
function vGrid(v: View) {
  const n = v.rows[0].length, ax = v.ax !== false;
  const rl = (i: number) => (v.rowLabels ? show(v.rowLabels[i]) : i), cl = (j: number) => (v.colLabels ? show(v.colLabels[j]) : j);
  const hasFeedsProp = Array.isArray(v.feeds), hasSwapsProp = Array.isArray(v.swaps);
  const feeds = hasFeedsProp ? v.feeds : undefined;
  const swaps = hasSwapsProp ? (v.swaps as [[number, number], [number, number]][]) : undefined;
  const swMap = new Map<string, string>();
  for (const [a, b] of swaps || []) {
    if (a[0] !== b[0] || a[1] !== b[1]) {
      swMap.set(`${a[0]},${a[1]}`, "dm-swap-a");
      swMap.set(`${b[0]},${b[1]}`, "dm-swap-b");
    }
  }
  let h = ax ? `<span class="dm-ax"></span>` + v.rows[0].map((_: unknown, j: number) => `<span class="dm-ax">${cl(j)}</span>`).join("") : "";
  (v.rows as unknown[][]).forEach((r, i) => {
    h += (ax ? `<span class="dm-ax">${rl(i)}</span>` : "") + r.map(norm).map((it, j) => {
      const body = cellBody(it);
      const sc = swMap.get(`${i},${j}`) || "";
      return `<div class="dm-cell ${roles(it.cls)}${body.changed ? " dm-changed" : ""}${sc ? ` ${sc}` : ""}" data-rc="${i},${j}" data-val="${show(it.v)}">${body.html}</div>`;
    }).join("");
  });
  const cols = (ax ? "minmax(18px,auto) " : "") + `repeat(${n},${hasFeedsProp ? 44 : 40}px)`;
  const attrs = `${feeds?.length ? ` data-feeds="${E(JSON.stringify(feeds))}"` : ""}${swaps?.length ? ` data-swaps="${E(JSON.stringify(swaps))}"` : ""}`;
  const scrollCls = hasSwapsProp || hasFeedsProp ? "dm-scroll dm-pad-top" : "dm-scroll";
  return `<div class="dm-v">${lab(v)}<div class="${scrollCls}"><div class="dm-grid${hasFeedsProp ? " dm-grid-feeds" : ""}" style="grid-template-columns:${cols}"${attrs}>${h}</div></div></div>`;
}

/**
 * 几张图并排，中间用 sep（默认 →）隔开。题面配图里「变换前 → 变换后」用。
 * 每张图最大是原来的尺寸，地方不够时先一起缩小，缩到 70% 还放不下就折到下一行（长链表、宽的树不会被挤得很小）。
 */
function vRow(v: View) {
  const parts = (v.items as View[]).map((x) => {
    const html = renderViews([x]), w = Number(html.match(/viewBox="0 0 ([\d.]+) /)?.[1]);
    return `<div class="dm-ri"${w ? ` style="flex:1 1 ${Math.round(w * 0.7)}px;max-width:${Math.round(w)}px"` : ""}>${html}</div>`;
  });
  return `<div class="dm-v">${lab(v)}<div class="dm-row">${parts.join(`<div class="dm-sep">${E(v.sep ?? "→")}</div>`)}</div></div>`;
}

/**
 * 自由摆放的节点和箭头：nodes [{ id, v, x, y, cls, shape: "rect" | "circle" }]，坐标是格子数；
 * edges [{ from, to, cls, bend }]，bend 让箭头弯一点（正负决定往哪边弯）；labels [{ x, y, text }]。
 * 链表、树画不出来的形状（相交链表的 Y 形）用它。
 */
function vGraph(v: View) {
  const UX = v.ux || 62, UY = v.uy || 58, BW = 40, BH = 32, R = 17, id = "dmgh" + uid++;
  const nodes = v.nodes as { id: string | number; v: unknown; x: number; y: number; cls?: string; shape?: string }[];
  const labels = (v.labels || []) as { x: number; y: number; text: string }[];
  const xs = [...nodes.map((n) => n.x), ...labels.map((l) => l.x)], ys = [...nodes.map((n) => n.y), ...labels.map((l) => l.y)];
  const x0 = Math.min(...xs), y0 = Math.min(...ys), PAD = 28;
  const px = (x: number) => PAD + 20 + (x - x0) * UX, py = (y: number) => PAD + (y - y0) * UY;
  const W = PAD * 2 + 40 + (Math.max(...xs) - x0) * UX, H = PAD * 2 + (Math.max(...ys) - y0) * UY;
  const by: Record<string, (typeof nodes)[number]> = {};
  nodes.forEach((n) => (by[String(n.id)] = n));
  const reach = (n: (typeof nodes)[number], dx: number, dy: number) =>
    n.shape === "circle" ? R : Math.min(dx ? BW / 2 / Math.abs(dx) : Infinity, dy ? BH / 2 / Math.abs(dy) : Infinity);
  let s = `<defs><marker id="${id}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker></defs>`;
  for (const e of (v.edges || []) as { from: string | number; to: string | number; cls?: string; bend?: number }[]) {
    const a = by[String(e.from)], b = by[String(e.to)];
    if (!a || !b) continue;
    const ax = px(a.x), ay = py(a.y), bx = px(b.x), by2 = py(b.y), len = Math.hypot(bx - ax, by2 - ay) || 1;
    const dx = (bx - ax) / len, dy = (by2 - ay) / len, ra = reach(a, dx, dy), rb = reach(b, dx, dy) + 2;
    const sx = ax + dx * ra, sy = ay + dy * ra, ex = bx - dx * rb, ey = by2 - dy * rb;
    if (e.bend) {
      const cx = (sx + ex) / 2 - dy * e.bend * UY, cy = (sy + ey) / 2 + dx * e.bend * UY;
      s += `<path class="edge ${e.cls || ""}" marker-end="url(#${id})" d="M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}"></path>`;
    } else s += `<line class="edge ${e.cls || ""}" marker-end="url(#${id})" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"></line>`;
  }
  for (const n of nodes) {
    const cx = px(n.x), cy = py(n.y), c = first(n.cls);
    s += n.shape === "circle"
      ? `<circle class="n ${roles(n.cls)}" cx="${cx}" cy="${cy}" r="${R}"></circle>`
      : `<rect class="n ${roles(n.cls)}" x="${cx - BW / 2}" y="${cy - BH / 2}" width="${BW}" height="${BH}" rx="6"></rect>`;
    s += `<text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${cx}" y="${cy}">${show(n.v)}</text>`;
  }
  for (const l of labels) s += `<text class="pt" x="${px(l.x)}" y="${py(l.y)}">${E(l.text)}</text>`;
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><svg class="dm-g2" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%"><g>${s}</g></svg></div></div>`;
}

function vChips(v: View) {
  const items = (v.items as unknown[]).map(norm);
  return `<div class="dm-v">${lab(v)}<div class="dm-chips">${items.length ? items.map((it) => `<span class="dm-chip ${roles(it.cls)}">${show(it.v)}</span>`).join("") : `<span class="dm-empty">${v.empty || "空"}</span>`}</div></div>`;
}

let uid = 0;
function vList(v: View) {
  const nodes = (v.nodes as unknown[]).map(norm), n = nodes.length, GAP = 66, BW = 40, BH = 32, X0 = 30, Y = 46;
  const W = X0 * 2 + n * GAP, H = 108, id = "dmah" + uid++, idOn = "dmahon" + uid++, idCut = "dmahcut" + uid++;
  const cx = (i: number) => X0 + i * GAP + BW / 2;
  let s = `<defs><marker id="${id}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker><marker id="${idOn}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-on"></path></marker><marker id="${idCut}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-cut"></path></marker></defs>`;
  const next: (number | null)[] = v.next || nodes.map((_, i) => (i + 1 < n ? i + 1 : null));
  const animSet = new Set<number>(Array.isArray(v.animEdges) ? v.animEdges : []);

  const edge = (i: number, j: number | null | undefined, cls: string, lift: boolean, arc?: boolean, isCut?: boolean) => {
    if (j === null || j === undefined) return;
    if (j === -1) {
      if (i === n - 1) s += `<line class="edge ${cls}" x1="${cx(i) + BW / 2}" y1="${Y}" x2="${cx(i) + BW / 2 + 12}" y2="${Y}"></line><text class="nil" x="${cx(i) + BW / 2 + 20}" y="${Y}">∅</text>`;
      else if (i === 0) s += `<line class="edge ${cls}" x1="${cx(i) - BW / 2}" y1="${Y}" x2="${cx(i) - BW / 2 - 10}" y2="${Y}"></line><text class="nil" x="${cx(i) - BW / 2 - 18}" y="${Y}">∅</text>`;
      else s += `<line class="edge ${cls}" x1="${cx(i)}" y1="${Y - BH / 2}" x2="${cx(i)}" y2="${Y - BH / 2 - 9}"></line><text class="nil" x="${cx(i)}" y="${Y - BH / 2 - 17}">∅</text>`;
      return;
    }
    const mid = cls.includes("cut") ? idCut : cls.includes("on") ? idOn : id;
    if (j === i + 1 && !arc) {
      const mx = (cx(i) + BW / 2 + cx(j) - BW / 2 - 2) / 2;
      s += `<line class="edge ${cls}" marker-end="url(#${mid})" x1="${cx(i) + BW / 2}" y1="${Y - 4}" x2="${cx(j) - BW / 2 - 2}" y2="${Y - 4}"></line>`;
      if (isCut) s += `<text class="dm-cut-x" x="${mx}" y="${Y - 12}">×</text>`;
    } else if (j === i - 1 && !arc) {
      const mx = (cx(i) - BW / 2 + cx(j) + BW / 2 + 2) / 2;
      s += `<line class="edge ${cls}" marker-end="url(#${mid})" x1="${cx(i) - BW / 2}" y1="${Y + 6}" x2="${cx(j) + BW / 2 + 2}" y2="${Y + 6}"></line>`;
      if (isCut) s += `<text class="dm-cut-x" x="${mx}" y="${Y + 14}">×</text>`;
    } else if (j === i) {
      s += `<path class="edge ${cls}" marker-end="url(#${mid})" d="M${cx(i) - 8} ${Y - BH / 2} C${cx(i) - 18} ${Y - 40} ${cx(i) + 18} ${Y - 40} ${cx(i) + 8} ${Y - BH / 2 - 2}"></path>`;
    } else {
      const up = lift ? -1 : j > i ? -1 : 1, y0 = Y + up * (BH / 2), h = Math.min(30, 16 + Math.abs(j - i) * 4);
      const qx = (cx(i) + cx(j)) / 2, qy = y0 + up * h * 1.6;
      s += `<path class="edge ${cls}" marker-end="url(#${mid})" d="M${cx(i)} ${y0} Q${qx} ${qy} ${cx(j) + (j > i ? -6 : 6)} ${y0 + up * 2}"></path>`;
      if (isCut) s += `<text class="dm-cut-x" x="${qx}" y="${(y0 + qy) / 2}">×</text>`;
    }
  };

  // 被剪断的旧指向（虚线渐隐 + ×）
  ((v.ghostEdges || []) as [number, number][]).forEach(([i, j]) => edge(i, j, "cut", false, false, true));

  next.forEach((j, i) => {
    if (!nodes[i].hide) {
      const cls = `${nodes[i].ecls || ""}${animSet.has(i) ? " draw" : ""}`.trim();
      edge(i, j === null && v.showNil !== false && !nodes[i].noNil ? -1 : j, cls, false);
    }
  });
  ((v.extra || []) as [number, number][]).forEach(([i, j]) => edge(i, j, "warm", j > i, true));
  const pm = ptrMap(v.ptrs);
  nodes.forEach((nd, i) => {
    if (nd.hide) return;
    const c = first(nd.cls);
    const keyAttr = ` data-key="ln-${E(nd.key ?? i)}"`;
    const nodeHasPrev = nd.prev !== undefined && String(nd.prev) !== String(nd.v);
    s += `<g class="dm-lnode"${keyAttr}>`;
    s += `<rect class="n ${roles(nd.cls)}" x="${cx(i) - BW / 2}" y="${Y - BH / 2}" width="${BW}" height="${BH}" rx="6"></rect>`;
    s += `<text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${cx(i)}" y="${Y}">${show(nd.v)}</text>`;
    if (nodeHasPrev) {
      s += `<text class="dm-tprev" x="${cx(i)}" y="${Y - BH / 2 - 7}">${show(nd.prev)}→</text>`;
    }
    (pm[String(i)] || []).forEach((nm, k) => {
      s += `<text class="pt" x="${cx(i)}" y="${Y + BH / 2 + 12 + k * 13}">${E(nm)}</text>`;
    });
    s += `</g>`;
  });
  // 长链表：地方不够时先等比缩小，最多缩到 74%（字还看得清），再窄才在框里横着滚
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><svg class="dm-g2" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%;min-width:${Math.round(W * 0.74)}px"><g>${s}</g></svg></div></div>`;
}

function vTree(v: View) {
  const pm = ptrMap(v.ptrs);
  const maxPtrLines = Math.max(0, ...Object.values(pm).map((arr) => arr.length));
  const hasPrev = Object.values(v.nodes || {}).some((nd: any) => nd && nd.prev !== undefined && String(nd.prev) !== String(nd.v));
  const PAD = v.badges || v.ptrs ? 46 : 32;
  const GAPX = v.badges || v.ptrs ? 54 : 46;
  const ptrHead = maxPtrLines ? 12 + maxPtrLines * 13 : 0;
  const prevHead = hasPrev ? 14 : 0;
  const TOP = 26 + Math.max(ptrHead, prevHead) + (ptrHead && prevHead ? 10 : 0);
  const LEVEL_Y = 66;
  const R = 17;

  const layoutTree = (nodesObj: Record<string, any>, rootId: any) => {
    const pos: Record<string, [number, number]> = {};
    const parList: { from: string; to: string; side: "L" | "R" }[] = [];
    const visited = new Set<string>();
    let x = 0;
    const walk = (id: any, d: number) => {
      if (id === null || id === undefined) return;
      const sid = String(id);
      if (!nodesObj?.[id] || visited.has(sid)) return;
      visited.add(sid);
      const nd = nodesObj[id];
      walk(nd.l, d + 1);
      pos[sid] = [PAD + x * GAPX, TOP + d * LEVEL_Y];
      x++;
      walk(nd.r, d + 1);
      if (nd.l !== null && nd.l !== undefined && nodesObj[nd.l]) parList.push({ from: sid, to: String(nd.l), side: "L" });
      if (nd.r !== null && nd.r !== undefined && nodesObj[nd.r]) parList.push({ from: sid, to: String(nd.r), side: "R" });
    };
    walk(rootId, 0);
    return { pos, parList };
  };

  const { pos, parList } = layoutTree(v.nodes, v.root);
  const prevPos = v.prevNodes ? layoutTree(v.prevNodes, v.root).pos : null;
  const morphIds = prevPos
    ? Object.keys(pos).filter((id) => !prevPos[id] || prevPos[id][0] !== pos[id][0] || prevPos[id][1] !== pos[id][1])
    : [];
  const morphData = morphIds.length && prevPos
    ? { R, directed: !!v.directed, lrLabels: !!v.lrLabels, from: prevPos, to: pos }
    : null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const cover = (x0: number, y0: number, x1: number, y1: number) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  const coverNodes = (pMap: Record<string, [number, number]>, nodesObj: Record<string, any>) => {
    for (const id of Object.keys(pMap)) {
      const [px, py] = pMap[id];
      const nd = nodesObj?.[id];
      const nPtrs = (pm[id] || []).length;
      const nPrev = nd && nd.prev !== undefined && String(nd.prev) !== String(nd.v) ? 1 : 0;
      const hasB = v.badges && v.badges[id] !== undefined && v.badges[id] !== null;
      const topReach = R + 6 + (nPrev ? 14 : 0) + (nPtrs ? 8 + nPtrs * 13 : 0);
      const botReach = R + (hasB ? 24 : 10);
      cover(px - R - 14, py - topReach, px + R + 14, py + botReach);
    }
  };
  coverNodes(pos, v.nodes);
  if (morphData && prevPos) coverNodes(prevPos, v.prevNodes);
  if (!Number.isFinite(minX)) cover(0, 0, 140, 80);

  const cls = v.cls || {};
  const on = new Set((v.on || []).map(String));
  const onEdgeSet = new Set(((v.onEdges || []) as [string | number, string | number][]).map(([a, b]) => `${a}->${b}`));
  const animEdges = new Set(((v.animEdges || []) as [string | number, string | number][]).map(([a, b]) => `${a}->${b}`));
  const cutEdges = (v.cutEdges || []) as [string | number, string | number][];
  const cutSet = new Set(cutEdges.map(([a, b]) => `${a}->${b}`));
  const ahId = "dmtr" + uid++;
  const ahOnId = "dmtron" + uid++;
  const ahCutId = "dmtrcut" + uid++;

  let s = (v.directed || (v.extra && v.extra.length) || cutEdges.length)
    ? `<defs><marker id="${ahId}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker><marker id="${ahOnId}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-on"></path></marker><marker id="${ahCutId}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-cut"></path></marker></defs>`
    : "";
  let lblSvg = "";

  const drawEdge = (x1: number, y1: number, x2: number, y2: number, eCls: string, arrow: boolean, side?: "L" | "R", cut?: boolean, fromId?: string, toId?: string) => {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const sx = x1 + ux * R, sy = y1 + uy * R;
    const ex = x2 - ux * (arrow ? R + 3 : R), ey = y2 - uy * (arrow ? R + 3 : R);
    const mid = cut ? ahCutId : eCls.includes("on") ? ahOnId : ahId;
    const endAttr = !cut && fromId !== undefined && toId !== undefined ? ` data-from="${E(fromId)}" data-to="${E(toId)}"` : "";
    s += `<line class="edge ${eCls}"${endAttr}${arrow ? ` marker-end="url(#${mid})"` : ""} x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"></line>`;
    if (side && v.lrLabels) {
      const nx = -uy, ny = ux, sgn = side === "L" ? 1 : -1;
      const mx = (sx + ex) / 2 + nx * sgn * 10;
      const my = (sy + ey) / 2 + ny * sgn * 10;
      const lblAttr = fromId !== undefined && toId !== undefined ? ` data-efrom="${E(fromId)}" data-eto="${E(toId)}" data-eside="${side}"` : "";
      s += `<text class="dm-lr"${lblAttr} x="${mx}" y="${my}">${side}</text>`;
      cover(mx - 10, my - 10, mx + 10, my + 10);
    }
    if (cut) {
      const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
      s += `<text class="dm-cut-x" x="${cx}" y="${cy}">×</text>`;
    }
  };

  for (const e of parList) {
    if (cutSet.has(`${e.from}->${e.to}`)) continue;
    const p1 = pos[e.from], p2 = pos[e.to];
    if (!p1 || !p2) continue;
    const key = `${e.from}->${e.to}`;
    const isOn = (on.has(e.from) && on.has(e.to)) || onEdgeSet.has(key);
    const isAnim = animEdges.has(key);
    const eCls = `${isOn ? "on" : ""}${isAnim ? " draw" : ""}`.trim();
    drawEdge(p1[0], p1[1], p2[0], p2[1], eCls, !!v.directed, e.side, false, e.from, e.to);
  }

  for (const [a, b] of cutEdges) {
    const p1 = pos[String(a)], p2 = pos[String(b)];
    if (!p1 || !p2) continue;
    drawEdge(p1[0], p1[1], p2[0], p2[1], "cut", !!v.directed, undefined, true);
  }

  for (const ex of (v.extra || []) as { from: string | number; to: string | number; cls?: string; bend?: number; anim?: string; label?: string }[]) {
    const p1 = pos[String(ex.from)], p2 = pos[String(ex.to)];
    if (!p1 || !p2) continue;
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const sx = p1[0] + ux * R, sy = p1[1] + uy * R;
    const exX = p2[0] - ux * (R + 3), exY = p2[1] - uy * (R + 3);
    const bend = ex.bend ?? 0.35;
    const cx = (sx + exX) / 2 - uy * bend * 64;
    const cy = (sy + exY) / 2 + ux * bend * 64;
    const eCls = `${ex.cls || "on"}${ex.anim ? ` ${ex.anim}` : ""}`.trim();
    const isOn = eCls.includes("on");
    s += `<path class="edge ${eCls}" marker-end="url(#${isOn ? ahOnId : ahId})" d="M${sx} ${sy} Q${cx} ${cy} ${exX} ${exY}"></path>`;
    const mx = (sx + 2 * cx + exX) / 4, my = (sy + 2 * cy + exY) / 4;
    cover(mx - 18, my - 14, mx + 18, my + 14);
    if (ex.label) {
      // 胶囊标牌放到最顶层并沿弯弧外侧法线推开半个胶囊宽高，彻底避免箭头/线条压住文字
      const sign = bend >= 0 ? 1 : -1;
      const nx = -uy * sign, ny = ux * sign;
      const tw = [...ex.label].reduce((acc, ch) => acc + (/[\u4e00-\u9fff]/.test(ch) ? 11 : 6.5), 0);
      const pw = Math.ceil(tw + 12), ph = 18;
      const dist = Math.abs(nx) * (pw / 2 * 0.78) + Math.abs(ny) * (ph / 2 + 4) + 6;
      const lx = mx + nx * dist, ly = my + ny * dist;
      lblSvg += `<rect class="dm-edge-bg" x="${lx - pw / 2}" y="${ly - ph / 2}" width="${pw}" height="${ph}" rx="6"></rect>`;
      lblSvg += `<text class="dm-edge-lbl" x="${lx}" y="${ly}">${E(ex.label)}</text>`;
      cover(lx - pw / 2 - 4, ly - ph / 2 - 4, lx + pw / 2 + 4, ly + ph / 2 + 4);
    }
  }

  const swapSet = new Set<string>();
  for (const [a, b] of (v.swaps || []) as [string | number, string | number][]) {
    const sa = String(a), sb = String(b);
    swapSet.add(sa); swapSet.add(sb);
    const p1 = pos[sa], p2 = pos[sb];
    if (!p1 || !p2) continue;
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const sx = p1[0] + ux * R, sy = p1[1] + uy * R;
    const exX = p2[0] - ux * (R + 3), exY = p2[1] - uy * (R + 3);
    const cx = (sx + exX) / 2 - uy * 26;
    const cy = (sy + exY) / 2 + ux * 26;
    s += `<path class="edge on draw" marker-start="url(#${ahOnId})" marker-end="url(#${ahOnId})" d="M${sx} ${sy} Q${cx} ${cy} ${exX} ${exY}"></path>`;
    cover(cx - 18, cy - 18, cx + 18, cy + 18);
  }

  for (const id of Object.keys(pos)) {
    const [px, py] = pos[id];
    const nd = v.nodes[id];
    const c = first(cls[id]);
    const swapCls = swapSet.has(id) ? " dm-tswap" : "";
    const nodeHasPrev = nd.prev !== undefined && String(nd.prev) !== String(nd.v);
    s += `<g class="dm-tnode${swapCls}" data-key="tn-${E(id)}" transform="translate(${px},${py})">`;
    s += `<circle class="n ${roles(cls[id])}" cx="0" cy="0" r="${R}"></circle>`;
    s += `<text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="0" y="0">${show(nd.v)}</text>`;
    if (nodeHasPrev) {
      s += `<text class="dm-tprev" x="0" y="-${R + 8}">${show(nd.prev)}→</text>`;
    }
    const b = v.badges && v.badges[id];
    if (b !== undefined && b !== null) {
      const t = String(b), w = Math.max(26, t.length * 7 + 10);
      s += `<rect class="bd" x="${-w / 2}" y="21" width="${w}" height="16" rx="8"></rect><text class="bt" x="0" y="29">${E(t)}</text>`;
    }
    (pm[id] || []).forEach((nm, k) => {
      const pyOff = -(R + 10 + (nodeHasPrev ? 13 : 0) + k * 13);
      s += `<text class="pt" x="0" y="${pyOff}">${E(nm)}</text>`;
    });
    s += `</g>`;
  }
  const vbW = Math.max(140, Math.round(maxX - minX));
  const vbH = Math.max(80, Math.round(maxY - minY));
  const morphAttr = morphData ? ` data-morph="${E(JSON.stringify(morphData))}"` : "";
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><svg class="dm-g2"${morphAttr} viewBox="${Math.round(minX)} ${Math.round(minY)} ${vbW} ${vbH}" style="width:${Math.round(vbW * 1.12)}px;max-width:100%"><g>${s}${lblSvg}</g></svg></div></div>`;
}

/**
 * 网络图（基础专题里的图、拓扑排序、并查集用）：nodes 是节点（{ v, cls }），edges 是 [起点下标, 终点下标, 边的样式?]
 * （样式：on 高亮 / warm 虚线 / dim 变淡）。directed 为真时画箭头；pos 是每个节点的 [列, 行]（可以是小数），
 * 不给时节点排成一圈。badges 是节点下方的小标签。要自由摆放、带弯曲箭头的图用上面的 graph。
 */
function vNet(v: View) {
  const nodes = (v.nodes as unknown[]).map(norm), n = nodes.length, RAD = 17, id = "dmnet" + uid++, idOn = "dmneton" + uid++, idCut = "dmnetcut" + uid++;
  const hasPrev = nodes.some((nd) => !nd.hide && nd.prev !== undefined && String(nd.prev) !== String(nd.v));
  let pos: [number, number][];
  let W: number, H: number;
  if (v.pos) {
    const GAP = 74, PAD = 30;
    pos = (v.pos as [number, number][]).map(([c, r]) => [PAD + c * GAP, PAD + r * GAP]);
    W = Math.max(...pos.map((p) => p[0])) + PAD;
    H = Math.max(...pos.map((p) => p[1])) + PAD + (v.badges ? 22 : 0);
  } else {
    const R = Math.max(60, n * 13), C = R + 34;
    pos = nodes.map((_, i) => [C + R * Math.sin((2 * Math.PI * i) / n), C - R * Math.cos((2 * Math.PI * i) / n)]);
    W = H = 2 * C + (v.badges ? 22 : 0);
  }
  let s = v.directed
    ? `<defs><marker id="${id}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker><marker id="${idOn}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-on"></path></marker><marker id="${idCut}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-cut"></path></marker></defs>`
    : "";
  for (const [a, b, cls] of (v.edges || []) as [number, number, string?][]) {
    if (!pos[a] || !pos[b]) continue;
    const [x1, y1] = pos[a], [x2, y2] = pos[b], d = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d, end = v.directed ? RAD + 3 : RAD;
    const isCut = !!cls?.includes("cut");
    const mid = isCut ? idCut : cls?.includes("on") ? idOn : id;
    const sx = x1 + ux * RAD, sy = y1 + uy * RAD, ex = x2 - ux * end, ey = y2 - uy * end;
    s += `<line class="edge ${cls || ""}"${v.directed ? ` marker-end="url(#${mid})"` : ""} x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"></line>`;
    if (isCut) s += `<text class="dm-cut-x" x="${(sx + ex) / 2}" y="${(sy + ey) / 2}">×</text>`;
  }
  nodes.forEach((nd, i) => {
    if (nd.hide) return;
    const [px, py] = pos[i], c = first(nd.cls);
    const nodeHasPrev = nd.prev !== undefined && String(nd.prev) !== String(nd.v);
    s += `<circle class="n ${roles(nd.cls)}" cx="${px}" cy="${py}" r="${RAD}"></circle><text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${px}" y="${py}">${show(nd.v)}</text>`;
    if (nodeHasPrev) s += `<text class="dm-tprev" x="${px}" y="${py - RAD - 8}">${show(nd.prev)}→</text>`;
    const b = v.badges && v.badges[i];
    if (b !== undefined && b !== null && b !== "") {
      const t = String(b), w = Math.max(26, t.length * 7 + 10);
      s += `<rect class="bd" x="${px - w / 2}" y="${py + 21}" width="${w}" height="16" rx="8"></rect><text class="bt" x="${px}" y="${py + 29}">${E(t)}</text>`;
    }
  });
  const minY = hasPrev ? -16 : 0, vbH = H + (hasPrev ? 16 : 0);
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><svg class="dm-g2" viewBox="0 ${minY} ${W} ${vbH}" style="width:${W}px;max-width:100%"><g>${s}</g></svg></div></div>`;
}

const R: Record<string, (v: View) => string> = {
  array: vArray,
  bars: vBars,
  grid: vGrid,
  chips: vChips,
  list: vList,
  tree: vTree,
  row: vRow,
  graph: vGraph,
  net: vNet,
  note: (v) => `<div class="dm-v">${lab(v)}<div class="dm-note">${v.html}</div></div>`,
};

export function renderViews(views: View[]) {
  return views.map((v) => (R[v.t] ? R[v.t](v) : "")).join("");
}

export const escapeHtml = E;
