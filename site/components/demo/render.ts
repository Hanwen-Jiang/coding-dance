// 把演示的一步（views）渲染成 HTML。移植自 tools/illustrations/engine.js，
// 只是类名都加了 dm- 前缀、颜色角色改成 r-*，避免和 HeroUI / Tailwind 的类名冲突。

/* eslint-disable @typescript-eslint/no-explicit-any */
type Item = { v?: unknown; cls?: string; water?: number; hide?: boolean; ecls?: string; noNil?: boolean };
type View = Record<string, any>;

const E = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const INV = new Set(["a", "b", "c"]);
const roles = (cls?: string) => (cls || "").split(/\s+/).filter(Boolean).map((t) => "r-" + t).join(" ");
const first = (cls?: string) => (cls || "").split(" ")[0];
const lab = (v: View) => (v.label ? `<div class="dm-vl">${v.label}</div>` : "");
const norm = (it: unknown): Item => (it !== null && typeof it === "object" ? (it as Item) : { v: it });
const show = (x: unknown) => (x === null || x === undefined ? "" : E(x));

function ptrMap(ptrs?: Record<string, number | null | undefined>) {
  const m: Record<number, string[]> = {};
  for (const [name, i] of Object.entries(ptrs || {})) if (i !== null && i !== undefined) (m[i] = m[i] || []).push(name);
  return m;
}

/** 下标那一行写什么：labels 可以逐个指定（比如越界的格子写 -1），否则从 idxFrom（默认 0）开始数 */
const idxLabel = (v: View, i: number) => (v.labels ? show(v.labels[i]) : v.idxFrom ? i + v.idxFrom : i);

function vArray(v: View) {
  const pm = ptrMap(v.ptrs), hasP = v.ptrs !== undefined;
  const cols = (v.items as unknown[]).map(norm).map((it, i) =>
    `<div class="dm-cc"><div class="dm-cell ${roles(it.cls)}">${show(it.v)}</div>` +
    (v.idx === false ? "" : `<div class="dm-ci">${idxLabel(v, i)}</div>`) +
    (hasP ? `<div class="dm-cp">${(pm[i] || []).map((n) => `<span>${E(n)}</span>`).join("")}</div>` : "") + `</div>`).join("");
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><div class="dm-arr">${cols}</div></div></div>`;
}

function vBars(v: View) {
  const items = (v.items as unknown[]).map(norm), pm = ptrMap(v.ptrs);
  const max = Math.max(1, ...items.map((it) => Number(it.v) + (it.water || 0)), v.max || 0);
  const cols = items.map((it, i) => {
    const val = Number(it.v), small = val / max < 0.16;
    return `<div class="dm-cc"><div class="dm-bar-slot">` +
      (small ? `<div class="dm-bv">${show(it.v)}</div>` : "") +
      (it.water ? `<div class="dm-wat" style="height:${(it.water / max) * 100}%"></div>` : "") +
      `<div class="dm-bar ${roles(it.cls)}" style="height:${(val / max) * 100}%">${small ? "" : show(it.v)}</div></div>` +
      `<div class="dm-ci">${i}</div><div class="dm-cp">${(pm[i] || []).map((n) => `<span>${E(n)}</span>`).join("")}</div></div>`;
  }).join("");
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><div class="dm-arr">${cols}</div></div></div>`;
}

/** 网格：rowLabels / colLabels 可以替代行列号（越界的那一行写 -1），ax: false 不画行列号 */
function vGrid(v: View) {
  const n = v.rows[0].length, ax = v.ax !== false;
  const rl = (i: number) => (v.rowLabels ? show(v.rowLabels[i]) : i), cl = (j: number) => (v.colLabels ? show(v.colLabels[j]) : j);
  let h = ax ? `<span class="dm-ax"></span>` + v.rows[0].map((_: unknown, j: number) => `<span class="dm-ax">${cl(j)}</span>`).join("") : "";
  (v.rows as unknown[][]).forEach((r, i) => {
    h += (ax ? `<span class="dm-ax">${rl(i)}</span>` : "") + r.map(norm).map((it) => `<div class="dm-cell ${roles(it.cls)}">${show(it.v)}</div>`).join("");
  });
  const cols = (ax ? "minmax(18px,auto) " : "") + `repeat(${n},40px)`;
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><div class="dm-grid" style="grid-template-columns:${cols}">${h}</div></div></div>`;
}

/** 几张图并排，中间用 sep（默认 →）隔开。题面配图里「变换前 → 变换后」用 */
function vRow(v: View) {
  const parts = (v.items as View[]).map((x) => `<div class="dm-ri">${renderViews([x])}</div>`);
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
  // 从中心沿方向 (dx, dy) 走到节点边上的距离
  const reach = (n: (typeof nodes)[number], dx: number, dy: number) =>
    n.shape === "circle" ? R : Math.min(dx ? BW / 2 / Math.abs(dx) : Infinity, dy ? BH / 2 / Math.abs(dy) : Infinity);
  let s = `<defs><marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker></defs>`;
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
  const nodes = (v.nodes as unknown[]).map(norm), n = nodes.length, GAP = 62, BW = 40, BH = 32, X0 = 30, Y = 46;
  const W = X0 * 2 + n * GAP, H = 108, id = "dmah" + uid++;
  const cx = (i: number) => X0 + i * GAP + BW / 2;
  let s = `<defs><marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker></defs>`;
  const next: (number | null)[] = v.next || nodes.map((_, i) => (i + 1 < n ? i + 1 : null));
  const edge = (i: number, j: number | null | undefined, cls: string, lift: boolean, arc?: boolean) => {
    if (j === null || j === undefined) return;
    if (j === -1) {
      if (i === n - 1) s += `<line class="edge ${cls}" x1="${cx(i) + BW / 2}" y1="${Y}" x2="${cx(i) + BW / 2 + 12}" y2="${Y}"></line><text class="nil" x="${cx(i) + BW / 2 + 20}" y="${Y}">∅</text>`;
      else if (i === 0) s += `<line class="edge ${cls}" x1="${cx(i) - BW / 2}" y1="${Y}" x2="${cx(i) - BW / 2 - 10}" y2="${Y}"></line><text class="nil" x="${cx(i) - BW / 2 - 18}" y="${Y}">∅</text>`;
      else s += `<line class="edge ${cls}" x1="${cx(i)}" y1="${Y - BH / 2}" x2="${cx(i)}" y2="${Y - BH / 2 - 9}"></line><text class="nil" x="${cx(i)}" y="${Y - BH / 2 - 17}">∅</text>`;
      return;
    }
    if (j === i + 1 && !arc) s += `<line class="edge ${cls}" marker-end="url(#${id})" x1="${cx(i) + BW / 2}" y1="${Y - 4}" x2="${cx(j) - BW / 2 - 2}" y2="${Y - 4}"></line>`;
    else if (j === i - 1 && !arc) s += `<line class="edge ${cls}" marker-end="url(#${id})" x1="${cx(i) - BW / 2}" y1="${Y + 6}" x2="${cx(j) + BW / 2 + 2}" y2="${Y + 6}"></line>`;
    else if (j === i) s += `<path class="edge ${cls}" marker-end="url(#${id})" d="M${cx(i) - 8} ${Y - BH / 2} C${cx(i) - 18} ${Y - 40} ${cx(i) + 18} ${Y - 40} ${cx(i) + 8} ${Y - BH / 2 - 2}"></path>`;
    else {
      const up = lift ? -1 : j > i ? -1 : 1, y0 = Y + up * (BH / 2), h = Math.min(30, 16 + Math.abs(j - i) * 4);
      s += `<path class="edge ${cls}" marker-end="url(#${id})" d="M${cx(i)} ${y0} Q${(cx(i) + cx(j)) / 2} ${y0 + up * h * 1.6} ${cx(j) + (j > i ? -6 : 6)} ${y0 + up * 2}"></path>`;
    }
  };
  next.forEach((j, i) => {
    if (!nodes[i].hide) edge(i, j === null && v.showNil !== false && !nodes[i].noNil ? -1 : j, nodes[i].ecls || "", false);
  });
  ((v.extra || []) as [number, number][]).forEach(([i, j]) => edge(i, j, "warm", j > i, true));
  const pm = ptrMap(v.ptrs);
  nodes.forEach((nd, i) => {
    if (nd.hide) return;
    const c = first(nd.cls);
    s += `<rect class="n ${roles(nd.cls)}" x="${cx(i) - BW / 2}" y="${Y - BH / 2}" width="${BW}" height="${BH}" rx="6"></rect>`;
    s += `<text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${cx(i)}" y="${Y}">${show(nd.v)}</text>`;
    (pm[i] || []).forEach((nm, k) => {
      s += `<text class="pt" x="${cx(i)}" y="${Y + BH / 2 + 12 + k * 13}">${E(nm)}</text>`;
    });
  });
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><svg class="dm-g2" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:none"><g>${s}</g></svg></div></div>`;
}

function vTree(v: View) {
  const pos: Record<string, [number, number]> = {}, par: Record<string, string> = {};
  const PAD = v.badges ? 44 : 28, GAPX = v.badges ? 54 : 46;
  let x = 0, depth = 0;
  const walk = (id: any, d: number) => {
    if (id === null || id === undefined || !v.nodes[id]) return;
    const nd = v.nodes[id];
    walk(nd.l, d + 1);
    pos[id] = [PAD + x * GAPX, 28 + d * 66];
    x++;
    depth = Math.max(depth, d);
    walk(nd.r, d + 1);
    for (const c of [nd.l, nd.r]) if (c !== null && c !== undefined && v.nodes[c]) par[c] = id;
  };
  walk(v.root, 0);
  const W = Math.max(PAD * 2 + (x - 1) * GAPX, 120), H = 56 + depth * 66 + (v.badges ? 22 : 0);
  const cls = v.cls || {}, on = new Set(v.on || []);
  let s = "";
  for (const id in par) {
    const [x1, y1] = pos[par[id]], [x2, y2] = pos[id];
    s += `<line class="edge ${on.has(+id) && on.has(+par[id]) ? "on" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
  }
  for (const id in pos) {
    const [px, py] = pos[id], c = first(cls[id]);
    s += `<circle class="n ${roles(cls[id])}" cx="${px}" cy="${py}" r="17"></circle><text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${px}" y="${py}">${show(v.nodes[id].v)}</text>`;
    const b = v.badges && v.badges[id];
    if (b !== undefined && b !== null) {
      const t = String(b), w = Math.max(26, t.length * 7 + 10);
      s += `<rect class="bd" x="${px - w / 2}" y="${py + 21}" width="${w}" height="16" rx="8"></rect><text class="bt" x="${px}" y="${py + 29}">${E(t)}</text>`;
    }
  }
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><svg class="dm-g2" viewBox="0 0 ${W} ${H}" style="width:${W * 1.15}px;max-width:100%"><g>${s}</g></svg></div></div>`;
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
  note: (v) => `<div class="dm-v">${lab(v)}<div class="dm-note">${v.html}</div></div>`,
};

export function renderViews(views: View[]) {
  return views.map((v) => (R[v.t] ? R[v.t](v) : "")).join("");
}

export const escapeHtml = E;
