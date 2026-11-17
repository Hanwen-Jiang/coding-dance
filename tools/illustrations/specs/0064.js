const F = require("../fig");

module.exports = {
  id: 64, name: "最小路径和", title: "最小路径和图解", level: "中等", topic: "多维动态规划",
  h1: "最小路径和，上面和左边挑小的",
  lede: "和不同路径一样，到达 (i, j) 的上一步只能在上面或左边。走到这里的最小路径和，就是这两个格子的最小路径和里较小的那个，再加上自己。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "minpath.jpg": [F.grid([[1, 3, 1], [1, 5, 1], [4, 2, 1]], { label: "路径 1 → 3 → 1 → 1 → 1 的和最小，是 7", cls: (v, i, j) => (i === 0 || j === 2 ? "e" : "") })],
  },
  hints: [
    { t: "定义状态", body: ["<code>dp[i][j]</code>：从左上角走到 <code>(i, j)</code> 的最小路径和。"] },
    { t: "转移", body: ["<code>dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + grid[i][j]</code>。", "第一行只能从左边来，第一列只能从上面来，要单独处理。"] },
    { t: "压成一行", body: ["按行更新时，<code>dp[j]</code> 更新前存的是上一行的值（上面），<code>dp[j-1]</code> 已经是这一行的值（左边）。一行数组就够了。"] },
  ],
  codes: [{ t: "标准解法：二维 DP", code: `
class Solution:
    def minPathSum(self, grid: List[List[int]]) -> int:
        m, n = len(grid), len(grid[0])  #@init
        dp = [[0] * n for _ in range(m)]  #@init
        for i in range(m):
            for j in range(n):
                if i == 0 and j == 0:   #@start
                    dp[i][j] = grid[0][0]   #@start
                elif i == 0:            #@row
                    dp[i][j] = dp[i][j - 1] + grid[i][j]    # 第一行只能从左边来 #@row
                elif j == 0:            #@col
                    dp[i][j] = dp[i - 1][j] + grid[i][j]    # 第一列只能从上面来 #@col
                else:                   #@mid
                    dp[i][j] = min(dp[i - 1][j], dp[i][j - 1]) + grid[i][j]  #@mid
        return dp[-1][-1]               #@done
` }, { t: "简洁写法：一行滚动（空间压缩）", key: "roll", kind: "elegant", note: "只留一行 dp。初始化成 inf 代表越界的第 -1 行（走不过来），只让 dp[0] = 0 作为起点的「上面」；j = 0 时左边越界也取 inf。这样第一行、第一列都不用特判。空间 O(n)。", code: `
from math import inf

class Solution:
    def minPathSum(self, grid: List[List[int]]) -> int:
        dp = [inf] * len(grid[0])       # 第 -1 行：越界，走不过来，全是 ∞ #@init
        dp[0] = 0                       # 只有起点的「上面」当成 0 #@init
        for row in grid:                #@row
            for j, x in enumerate(row):
                dp[j] = min(dp[j], dp[j - 1] if j else inf) + x  # 上面 dp[j]，左边 dp[j-1]（j = 0 越界取 ∞） #@cell
        return dp[-1]                   #@done
` }],
  sig: { fn: "minPathSum", params: ["int[][]"], ret: "int" },
  call: (a) => [a.grid],
  cases: [[[[5]]], [[[1], [2], [3]]], [[[1, 2, 3]]]],
  pytest: `
s = Solution()
assert s.minPathSum([[1,3,1],[1,5,1],[4,2,1]]) == 7
assert s.minPathSum([[1,2,3],[4,5,6]]) == 12
assert s.minPathSum([[5]]) == 5
assert s.minPathSum([[1],[2],[3]]) == 6
`,
  legend: [["a", "正在算的格子"], ["e", "上面和左边"], ["c", "最优路径"]],
  presets: [
    { label: "示例 1", args: { grid: [[1, 3, 1], [1, 5, 1], [4, 2, 1]] }, note: "grid = [[1,3,1],[1,5,1],[4,2,1]]", expect: 7 },
    { label: "示例 2", args: { grid: [[1, 2, 3], [4, 5, 6]] }, note: "grid = [[1,2,3],[4,5,6]]", expect: 12 },
  ],
  build(a, snap) {
    const g = a.grid, m = g.length, n = g[0].length, dp = g.map((r) => r.map(() => null));
    let path = [];
    const cls = (i, j, ci, cj) => (path.some(([x, y]) => x === i && y === j) ? "c" : i === ci && j === cj ? "a" : (i === ci - 1 && j === cj) || (i === ci && j === cj - 1) ? "e" : "");
    // dp 表外面多画一圈虚线：第 -1 行、第 -1 列越界，从那里走不过来，视作 ∞。读到它的时候标出来
    const ghost = (on) => (on ? "x e" : "x");
    const view = (ci, cj) => [
      { t: "grid", label: "grid", rows: g.map((r, i) => r.map((v, j) => ({ v, cls: cls(i, j, ci, cj) }))) },
      {
        t: "grid", label: "dp[i][j]：走到 (i, j) 的最小路径和（虚线是越界的位置，视作 ∞）",
        rowLabels: [-1, ...dp.map((_, i) => i)], colLabels: [-1, ...dp[0].map((_, j) => j)],
        rows: [
          [{ v: "", cls: "x" }, ...dp[0].map((_, j) => ({ v: "∞", cls: ghost(ci === 0 && cj === j) }))],
          ...dp.map((r, i) => [{ v: "∞", cls: ghost(cj === 0 && ci === i) }, ...r.map((v, j) => ({ v: v === null ? "" : v, cls: cls(i, j, ci, cj) }))]),
        ],
      },
    ];
    snap("开始", `从左上角 ${g[0][0]} 出发，只能向右或向下。`, view(-1, -1), { at: "init" });
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      let msg, at;
      if (!i && !j) { at = "start"; dp[i][j] = g[0][0]; msg = `起点：上面和左边都越界（∞），但起点不用从别处走来，dp 就是它自己 ${g[0][0]}。`; }
      else if (!i) { at = "row"; dp[i][j] = dp[i][j - 1] + g[i][j]; msg = `上面越界，视作 ∞（走不过来）；min(∞, 左边 ${dp[i][j - 1]}) = ${dp[i][j - 1]}，所以第一行只能从左边来：${dp[i][j - 1]} + ${g[i][j]} = <b>${dp[i][j]}</b>。`; }
      else if (!j) { at = "col"; dp[i][j] = dp[i - 1][j] + g[i][j]; msg = `左边越界，视作 ∞；min(上面 ${dp[i - 1][j]}, ∞) = ${dp[i - 1][j]}，所以第一列只能从上面来：${dp[i - 1][j]} + ${g[i][j]} = <b>${dp[i][j]}</b>。`; }
      else { at = "mid"; const u = dp[i - 1][j], l = dp[i][j - 1]; dp[i][j] = Math.min(u, l) + g[i][j]; msg = `上面 ${u}，左边 ${l}，取小的 ${Math.min(u, l)}，加上自己 ${g[i][j]}，dp = <b>${dp[i][j]}</b>。`; }
      snap(`(${i}, ${j})`, msg, view(i, j), { at });
    }
    let i = m - 1, j = n - 1; path = [[i, j]];
    while (i || j) { if (!i) j--; else if (!j) i--; else if (dp[i - 1][j] <= dp[i][j - 1]) i--; else j--; path.unshift([i, j]); }
    snap("完成", `最小路径和是 <b>${dp[m - 1][n - 1]}</b>，路径是 ${path.map(([x, y]) => g[x][y]).join(" → ")}。`, view(-1, -1), { at: "done", kind: "ok", ans: dp[m - 1][n - 1] });
  },
  alts: [{
    t: "空间压缩成一行",
    code: "roll",
    note: "和简洁写法一样只留一行 dp：更新前的 dp[j] 是上面（上一行），dp[j − 1] 是左边（这一行刚算的）。越界的位置都当成 ∞：一开始整行是 ∞（第 -1 行），j = 0 时左边也是 ∞。只有 dp[0] 先设成 0，让起点能「从上面走来」。",
    legend: [["a", "正在更新的 dp[j]"], ["k", "已经是这一行的值（左边）"], ["g", "还是上一行的值（上面）"], ["x", "越界的位置，视作 ∞"]],
    build(a, snap) {
      const g = a.grid, m = g.length, n = g[0].length, dp = Array(n).fill(Infinity);
      const sh = (v) => (v === Infinity ? "∞" : v);
      const view = (i, j, lab, hiGhost) => [
        { t: "grid", label: "grid", rows: g.map((r, x) => r.map((v, y) => ({ v, cls: x === i && y === j ? "a" : x < i || (x === i && y < j) ? "d" : "" }))) },
        { t: "array", label: lab, labels: [-1, ...dp.map((_, y) => y)], items: [{ v: "∞", cls: hiGhost ? "x e" : "x" }, ...dp.map((v, y) => ({ v: sh(v), cls: y === j ? "a" : y < j ? "k" : i <= 0 ? "x" : "g" }))] },
      ];
      snap("开始", "只留一行 dp。一开始它代表越界的第 -1 行：从那里走不过来，全是 ∞。dp 左边那格（下标 -1）也是越界，一直是 ∞。", view(-1, -1, "dp（一行）：第 -1 行，越界", false), { at: "init" });
      dp[0] = 0;
      snap("起点", "只把 dp[0] 设成 0：起点上面那格当成 0，这样起点 = min(0, ∞) + grid[0][0]，正好是它自己。", view(-1, 0, "dp（一行）：第 -1 行，只有 dp[0] 当成 0", false), { at: "init" });
      for (let i = 0; i < m; i++) {
        snap(`第 ${i} 行`, i === 0 ? "开始算第 0 行。dp 里还是越界的第 -1 行（除了 dp[0] = 0）。" : `开始算第 ${i} 行。dp 里现在整行都是第 ${i - 1} 行的值。`, view(i, -1, i === 0 ? "dp（一行）：现在是第 -1 行" : `dp（一行）：现在整行都是第 ${i - 1} 行`, false), { at: "row" });
        for (let j = 0; j < n; j++) {
          const up = dp[j], left = j ? dp[j - 1] : Infinity, x = g[i][j];
          dp[j] = Math.min(up, left) + x;
          const upTxt = i === 0 ? (j === 0 ? "0（起点特例）" : "∞（第 -1 行越界）") : `${sh(up)}（第 ${i - 1} 行）`;
          const leftTxt = j === 0 ? "∞（下标 -1 越界）" : `${sh(left)}（第 ${i} 行刚算的）`;
          snap(`(${i}, ${j})`, `上面 dp[${j}] = ${upTxt}，左边 dp[${j - 1}] = ${leftTxt}。取小的 ${sh(Math.min(up, left))}，加上 grid = ${x}，dp[${j}] = <b>${dp[j]}</b>。`, view(i, j, `dp（一行）：左边已经是第 ${i} 行，右边还是第 ${i - 1} 行`, j === 0), { at: "cell" });
        }
      }
      snap("完成", `最后一行算完，dp[${n - 1}] = <b>${dp[n - 1]}</b>。只用了长度 ${n} 的一行。`, view(m, n, `dp（一行）：现在整行都是第 ${m - 1} 行`, false), { at: "done", kind: "ok", ans: dp[n - 1] });
    },
  }],
  points: [
    { t: "边界单独处理", body: "第一行和第一列只有一个来源。用 inf 填充边界也可以省掉特判。" },
    { t: "可以原地修改", body: "直接把 grid 当 dp 用，空间 O(1)，但会改掉输入。" },
    { t: "复杂度", body: "时间 O(m·n)，一行滚动时空间 O(n)。" },
  ],
};
