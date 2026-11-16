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

function vArray(v: View) {
  const pm = ptrMap(v.ptrs), hasP = v.ptrs !== undefined;
  const cols = (v.items as unknown[]).map(norm).map((it, i) =>
    `<div class="dm-cc"><div class="dm-cell ${roles(it.cls)}">${show(it.v)}</div>` +
    (v.idx === false ? "" : `<div class="dm-ci">${v.idxFrom ? i + v.idxFrom : i}</div>`) +
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

function vGrid(v: View) {
  const n = v.rows[0].length;
  let h = `<span class="dm-ax"></span>` + v.rows[0].map((_: unknown, j: number) => `<span class="dm-ax">${j}</span>`).join("");
  (v.rows as unknown[][]).forEach((r, i) => {
    h += `<span class="dm-ax">${i}</span>` + r.map(norm).map((it) => `<div class="dm-cell ${roles(it.cls)}">${show(it.v)}</div>`).join("");
  });
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><div class="dm-grid" style="grid-template-columns:18px repeat(${n},40px)">${h}</div></div></div>`;
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

/**
 * 图：nodes 是节点（{ v, cls }），edges 是 [起点下标, 终点下标, 边的样式?]（样式：on 高亮 / warm 虚线 / dim 变淡）。
 * directed 为真时画箭头；pos 是每个节点的 [列, 行]（可以是小数），不给时节点排成一圈。badges 是节点下方的小标签。
 */
function vGraph(v: View) {
  const nodes = (v.nodes as unknown[]).map(norm), n = nodes.length, RAD = 17, id = "dmgh" + uid++;
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
  let s = v.directed ? `<defs><marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker></defs>` : "";
  for (const [a, b, cls] of (v.edges || []) as [number, number, string?][]) {
    if (!pos[a] || !pos[b]) continue;
    const [x1, y1] = pos[a], [x2, y2] = pos[b], d = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d, end = v.directed ? RAD + 3 : RAD;
    s += `<line class="edge ${cls || ""}"${v.directed ? ` marker-end="url(#${id})"` : ""} x1="${x1 + ux * RAD}" y1="${y1 + uy * RAD}" x2="${x2 - ux * end}" y2="${y2 - uy * end}"></line>`;
  }
  nodes.forEach((nd, i) => {
    if (nd.hide) return;
    const [px, py] = pos[i], c = first(nd.cls);
    s += `<circle class="n ${roles(nd.cls)}" cx="${px}" cy="${py}" r="${RAD}"></circle><text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${px}" y="${py}">${show(nd.v)}</text>`;
    const b = v.badges && v.badges[i];
    if (b !== undefined && b !== null && b !== "") {
      const t = String(b), w = Math.max(26, t.length * 7 + 10);
      s += `<rect class="bd" x="${px - w / 2}" y="${py + 21}" width="${w}" height="16" rx="8"></rect><text class="bt" x="${px}" y="${py + 29}">${E(t)}</text>`;
    }
  });
  return `<div class="dm-v">${lab(v)}<div class="dm-scroll"><svg class="dm-g2" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%"><g>${s}</g></svg></div></div>`;
}

const R: Record<string, (v: View) => string> = {
  array: vArray,
  bars: vBars,
  grid: vGrid,
  chips: vChips,
  list: vList,
  tree: vTree,
  graph: vGraph,
  note: (v) => `<div class="dm-v">${lab(v)}<div class="dm-note">${v.html}</div></div>`,
};

export function renderViews(views: View[]) {
  return views.map((v) => (R[v.t] ? R[v.t](v) : "")).join("");
}

export const escapeHtml = E;
