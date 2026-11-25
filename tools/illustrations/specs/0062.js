const F = require("../fig");

module.exports = {
  id: 62, name: "不同路径", title: "不同路径图解", level: "中等", topic: "多维动态规划",
  h1: "不同路径，从上面来或从左边来",
  lede: "机器人只能向右或向下走，所以到达格子 (i, j) 的上一步，要么在它上面，要么在它左边。到达它的路径数就是这两个格子的路径数之和。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "1697422740-adxmsI-image.png": [F.grid(Array.from({ length: 3 }, (_, i) => Array.from({ length: 7 }, (_, j) => (i === 0 && j === 0 ? "起" : i === 2 && j === 6 ? "终" : ""))), { label: "3 × 7 的网格：从左上角走到右下角，每次只能向右或向下", cls: (v) => (v === "起" ? "a" : v === "终" ? "c" : "") })],
  },
  hints: [
    { t: "最后一步从哪来", body: ["到 <code>(i, j)</code> 的上一步只可能是 <code>(i-1, j)</code> 或 <code>(i, j-1)</code>。", "<code>dp[i][j] = dp[i-1][j] + dp[i][j-1]</code>。"] },
    { t: "边界", body: ["第一行的格子只能一路向右走过去，第一列只能一路向下，路径数都是 1。"] },
    { t: "其实是组合数", body: ["从左上到右下一共要走 <code>m-1</code> 次向下、<code>n-1</code> 次向右。路径数就是在 <code>m+n-2</code> 步里挑哪几步向下：<code>C(m+n-2, m-1)</code>。"] },
  ],
  codes: [{ t: "标准解法：动态规划", code: `
class Solution:
    def uniquePaths(self, m: int, n: int) -> int:
        dp = [[1] * n for _ in range(m)]    # 第一行、第一列都只有 1 种走法 #@init
        for i in range(1, m):
            for j in range(1, n):
                dp[i][j] = dp[i - 1][j] + dp[i][j - 1]  # 从上面来 + 从左边来 #@cell
        return dp[-1][-1]                   #@done
` }, { t: "简洁写法：组合数", kind: "elegant", code: `
from math import comb

class Solution:
    def uniquePaths(self, m: int, n: int) -> int:
        return comb(m + n - 2, m - 1)       # m+n-2 步里挑 m-1 步向下
` }, { t: "进阶：空间压缩成一行", key: "roll", note: "算第 i 行只用到上面一行和这一行左边的格子，留一行 dp 就够了。更新前的 dp[j] 是上面，dp[j-1] 已经是这一行的左边。空间 O(n)。", code: `
class Solution:
    def uniquePaths(self, m: int, n: int) -> int:
        dp = [1] * n                        # 第 0 行：全是 1 #@init
        for i in range(1, m):               # dp[0] 是第 0 列，永远是 1，不用改 #@row
            for j in range(1, n):
                dp[j] += dp[j - 1]          # 原来的 dp[j] 是上面，dp[j-1] 是刚算好的左边 #@cell
        return dp[-1]                       #@done
` }],
  pytest: `
s = Solution()
assert s.uniquePaths(3, 7) == 28
assert s.uniquePaths(3, 2) == 3
assert s.uniquePaths(1, 1) == 1
assert s.uniquePaths(7, 3) == 28
assert s.uniquePaths(10, 10) == 48620
`,
  sig: { fn: "uniquePaths", params: ["int", "int"], ret: "int" },
  call: (a) => [a.m, a.n],
  cases: [[1, 1], [1, 5], [7, 3], [10, 10], [23, 12]],
  legend: [["a", "正在算的格子"], ["e", "上面和左边"], ["c", "终点"]],
  presets: [
    { label: "3 × 7", args: { m: 3, n: 7 }, note: "m = 3, n = 7", expect: 28 },
    { label: "3 × 2", args: { m: 3, n: 2 }, note: "m = 3, n = 2", expect: 3 },
  ],
  build(a, snap) {
    const { m, n } = a, dp = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => (i === 0 || j === 0 ? 1 : null)));
    // 表外面多画一圈虚线：第 -1 行、第 -1 列是越界的位置，没有路能从那里来，视作 0
    const view = (ci, cj, fin, edge, feeds = []) => [{
      t: "grid", label: "dp[i][j]：从左上走到 (i, j) 的路径数（虚线是越界的位置，视作 0）",
      rowLabels: [-1, ...dp.map((_, i) => i)], colLabels: [-1, ...dp[0].map((_, j) => j)],
      rows: [
        [{ v: "", cls: "x" }, ...dp[0].map(() => ({ v: 0, cls: edge ? "x e" : "x" }))],
        ...dp.map((r, i) => [{ v: 0, cls: edge ? "x e" : "x" }, ...r.map((v, j) => ({ v: v === null ? "" : v, cls: fin && i === m - 1 && j === n - 1 ? "c" : i === ci && j === cj ? "a" : (i === ci - 1 && j === cj) || (i === ci && j === cj - 1) ? "e" : edge && (i === 0 || j === 0) ? "k" : "" }))]),
      ],
      feeds: feeds.slice(),
    }];
    snap("边界", "第一行的格子，上面是越界的第 -1 行：那里不存在，没有路能从那里来，算 <b>0</b> 条。所以第一行只能从左边一路走过来，路径数是 0 + 1 = 1。第一列同理（左边越界，算 0）。代码里直接把第一行、第一列填成 1，就不用再判断越界了。", view(-1, -1, false, true, []), { at: "init", facts: [["网格", `${m} × ${n}`], ["边界", "第 0 行/列 = 1"]] });
    for (let i = 1; i < m; i++) for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
      snap(
        `(${i}, ${j})`,
        `从上面 (${i - 1}, ${j}) 来有 ${dp[i - 1][j]} 种，从左边 (${i}, ${j - 1}) 来有 ${dp[i][j - 1]} 种。dp = <b>${dp[i][j]}</b>。`,
        view(i, j, false, false, [
          { from: [i, j + 1], to: [i + 1, j + 1], win: true, label: "↑+←" },
          { from: [i + 1, j], to: [i + 1, j + 1], win: true },
        ]),
        { at: "cell", facts: [["位置", `(${i}, ${j})`], ["上面 + 左边", `${dp[i - 1][j]} + ${dp[i][j - 1]}`], ["dp[i][j]", dp[i][j]]] },
      );
    }
    snap("完成", `到右下角一共 <b>${dp[m - 1][n - 1]}</b> 条路径。`, view(-1, -1, true, false, []), { at: "done", kind: "ok", ans: dp[m - 1][n - 1], facts: [["网格", `${m} × ${n}`], ["总路径数", dp[m - 1][n - 1]]] });
  },
  alts: [{
    t: "空间压缩成一行",
    code: "roll",
    note: "二维表里算第 i 行只用到第 i − 1 行（上面）和第 i 行左边的格子，所以只留一行 dp：dp[j] += dp[j − 1]。更新 dp[j] 之前，它存的还是上一行的值（上面）；dp[j − 1] 已经先更新过，是这一行的值（左边）。",
    legend: [["a", "正在更新的 dp[j]"], ["k", "已经是这一行的值"], ["g", "还是上一行的值"], ["d", "二维表里已经丢掉的行"]],
    build(a, snap) {
      const { m, n } = a, full = Array.from({ length: m }, () => Array(n).fill(null)), dp = Array(n).fill(1);
      full[0] = dp.slice();
      const view = (i, j, opts = {}) => [
        {
          t: "grid",
          label: "对照：二维表（灰的行已经用完、丢掉了，一维 dp 里只有当前这一行）",
          rows: full.map((r, x) => r.map((v, y) => ({ v: v === null ? "" : v, cls: x === i && y === j ? "a" : x < i - 1 ? "d" : x === i - 1 ? "g" : x === i && v !== null ? "k" : "" }))),
          feeds: (opts.gridFeeds || []).slice(),
        },
        {
          t: "array",
          label: i === 0 || j >= n ? `dp（一行）：现在整行都是第 ${i} 行` : `dp（一行）：左边已经是第 ${i} 行，右边还是第 ${i - 1} 行`,
          items: dp.map((v, y) => ({
            v,
            ...(opts.prevMap && opts.prevMap[y] !== undefined ? { prev: opts.prevMap[y] } : {}),
            cls: y === j ? "a" : i === 0 || y < j || y === 0 ? "k" : "g",
          })),
          ptrs: { j: j >= 0 && j < n ? j : null },
          feeds: (opts.arrFeeds || []).slice(),
        },
      ];
      snap("开始", "只用一行 dp。一开始它就是第 0 行：全是 1。", view(0, -1), { at: "init", facts: [["当前行", 0], ["dp[n-1]", dp[n - 1]]] });
      for (let i = 1; i < m; i++) {
        full[i][0] = 1;
        snap(`第 ${i} 行`, `开始算第 ${i} 行。dp 里现在存的整行都是第 ${i - 1} 行的值；dp[0] 是第 0 列，永远是 1，不用改。`, view(i, -1), { at: "row", facts: [["当前行", i, i - 1], ["dp[0]", 1]] });
        for (let j = 1; j < n; j++) {
          const up = dp[j], left = dp[j - 1];
          dp[j] = up + left; full[i][j] = dp[j];
          snap(
            `(${i}, ${j})`,
            `dp[${j}] 更新前是 ${up}，这是第 ${i - 1} 行的值，也就是<b>上面</b>；dp[${j - 1}] = ${left} 刚更新过，是第 ${i} 行的值，也就是<b>左边</b>。dp[${j}] = ${up} + ${left} = <b>${dp[j]}</b>。`,
            view(i, j, {
              prevMap: { [j]: up },
              gridFeeds: [
                { from: [i - 1, j], to: [i, j], win: true, label: "↑+←" },
                { from: [i, j - 1], to: [i, j], win: true },
              ],
              arrFeeds: [{ from: j - 1, to: j, win: true, label: `+${left}` }],
            }),
            { at: "cell", facts: [["位置", `(${i}, ${j})`], ["上面 (旧dp[j])", up], ["左边 dp[j-1]", left], ["dp[j]", dp[j], up]] },
          );
        }
      }
      snap("完成", `最后一行算完，dp[${n - 1}] = <b>${dp[n - 1]}</b>。只用了长度 ${n} 的一行，空间从 O(m·n) 降到 O(n)。`, view(m - 1, n), { at: "done", kind: "ok", ans: dp[n - 1], facts: [["总路径数", dp[n - 1]], ["空间", `O(${n})`]] });
    },
  }],
  points: [
    { t: "可以压成一行", body: "<code>dp[j] += dp[j-1]</code>：更新前的 dp[j] 是上面的值，dp[j-1] 是刚更新过的左边的值。" },
    { t: "组合数不会溢出", body: "Python 的整数没有上限，Java 里要用 long 并且边乘边除。" },
    { t: "复杂度", body: "DP 时间 O(m·n)；组合数 O(min(m, n))。" },
  ],
};
