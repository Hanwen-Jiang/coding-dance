// 题面配图：把力扣题面里的图片换成和演示同一套画法的视图。网站上显示，深浅色跟着站点走。
// spec 里写 figures: { "<图片文件名>": [视图…] }，视图用这里的函数拼。build 会核对每张图都有对应的配图。
// 颜色角色和演示一样：a 当前 / b 对比 / c 结果 / d 暗 / e 浅蓝 / g 浅紫 / w 浅橙 / k 浅绿 / x 虚线。

/** 颜色：cls 可以是函数 (值, 下标...) => 角色，也可以是按值查的对象 { 7: "e" } */
const pick = (cls, ...a) => (typeof cls === "function" ? cls(...a) || "" : cls ? cls[a[0]] || "" : "");

/** 二叉树，vals 是力扣的层序数组（null 是空位）。cls(值, 层序下标) */
function tree(vals, { cls, label } = {}) {
  const nodes = {}, colors = {};
  if (!vals.length || vals[0] === null) return { t: "note", label, html: "空树" };
  let id = 0;
  const mk = (v, i) => { const k = id++; nodes[k] = { v, l: null, r: null }; const c = pick(cls, v, i); if (c) colors[k] = c; return k; };
  const root = mk(vals[0], 0), q = [root];
  for (let i = 1, h = 0; i < vals.length && h < q.length; h++) {
    for (const side of ["l", "r"]) {
      if (i >= vals.length) break;
      const v = vals[i];
      if (v !== null) { const k = mk(v, i); nodes[q[h]][side] = k; q.push(k); }
      i++;
    }
  }
  return { t: "tree", label, nodes, root, cls: colors };
}

/** 单链表。cycle：尾巴接回的下标（-1 不成环）；random：[[从, 到], …] 画成虚线；nil: false 不画末尾的空 */
function list(vals, { cls, label, cycle = -1, random, nil = true, ptrs } = {}) {
  const n = vals.length;
  return {
    t: "list", label, ptrs,
    nodes: vals.map((v, i) => ({ v, cls: pick(cls, v, i) })),
    next: vals.map((_, i) => (i + 1 < n ? i + 1 : cycle >= 0 ? cycle : null)),
    extra: random, showNil: nil && cycle < 0,
  };
}

/** 网格。cls(值, 行, 列)；ax: 画不画行列号（默认不画） */
function grid(rows, { cls, label, ax = false } = {}) {
  return { t: "grid", label, ax, rows: rows.map((r, i) => r.map((v, j) => ({ v, cls: pick(cls, v, i, j) }))) };
}

/** 一行格子 */
function array(vals, { cls, label, idx = true } = {}) {
  return { t: "array", label, idx, items: vals.map((v, i) => ({ v, cls: pick(cls, v, i) })) };
}

/** 柱状图。water：每根柱子上面的积水 */
function bars(vals, { cls, label, water } = {}) {
  return { t: "bars", label, items: vals.map((v, i) => ({ v, cls: pick(cls, v, i), water: water ? water[i] : 0 })) };
}

/** 几张图并排，中间默认用 → 隔开 */
const row = (items, { sep = "→", label } = {}) => ({ t: "row", label, sep, items });

/** 自由摆放：nodes [{ id, v, x, y, cls, shape }]，edges [[from, to, { cls, bend }]]，labels [{ x, y, text }] */
const graph = (nodes, edges, { labels, label } = {}) => ({
  t: "graph", label, labels, nodes,
  edges: edges.map(([from, to, o]) => ({ from, to, ...(o || {}) })),
});

const chips = (items, { label } = {}) => ({ t: "chips", label, items });
const note = (html, { label } = {}) => ({ t: "note", label, html });

module.exports = { tree, list, grid, array, bars, row, graph, chips, note };
