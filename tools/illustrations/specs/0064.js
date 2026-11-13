module.exports = {
  id: 64, name: "最小路径和", title: "最小路径和图解", level: "中等", topic: "多维动态规划",
  h1: "最小路径和，上面和左边挑小的",
  lede: "和不同路径一样，到达 (i, j) 的上一步只能在上面或左边。走到这里的最小路径和，就是这两个格子的最小路径和里较小的那个，再加上自己。",
  hints: [
    { t: "定义状态", body: ["<code>dp[i][j]</code>：从左上角走到 <code>(i, j)</code> 的最小路径和。"] },
    { t: "转移", body: ["<code>dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + grid[i][j]</code>。", "第一行只能从左边来，第一列只能从上面来，要单独处理。"] },
    { t: "压成一行", body: ["按行更新时，<code>dp[j]</code> 更新前存的是上一行的值（上面），<code>dp[j-1]</code> 已经是这一行的值（左边）。一行数组就够了。"] },
  ],
  codes: [{ t: "标准解法：二维 DP", code: `
class Solution:
    def minPathSum(self, grid: List[List[int]]) -> int:
        m, n = len(grid), len(grid[0])
        dp = [[0] * n for _ in range(m)]
        for i in range(m):
            for j in range(n):
                if i == 0 and j == 0:
                    dp[i][j] = grid[0][0]
                elif i == 0:
                    dp[i][j] = dp[i][j - 1] + grid[i][j]    # 第一行只能从左边来
                elif j == 0:
                    dp[i][j] = dp[i - 1][j] + grid[i][j]    # 第一列只能从上面来
                else:
                    dp[i][j] = min(dp[i - 1][j], dp[i][j - 1]) + grid[i][j]
        return dp[-1][-1]
` }, { t: "简洁写法：一行滚动", kind: "elegant", note: "dp 初始化成 inf、dp[0] = 0，第一行和第一列的边界就都不用特判了。", code: `
from math import inf

class Solution:
    def minPathSum(self, grid: List[List[int]]) -> int:
        dp = [inf] * len(grid[0])
        dp[0] = 0
        for row in grid:
            for j, x in enumerate(row):
                dp[j] = min(dp[j], dp[j - 1] if j else inf) + x
        return dp[-1]
` }],
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
    const view = (ci, cj) => [
      { t: "grid", label: "grid", rows: g.map((r, i) => r.map((v, j) => ({ v, cls: cls(i, j, ci, cj) }))) },
      { t: "grid", label: "dp[i][j]：走到 (i, j) 的最小路径和", rows: dp.map((r, i) => r.map((v, j) => ({ v: v === null ? "" : v, cls: cls(i, j, ci, cj) }))) },
    ];
    snap("开始", `从左上角 ${g[0][0]} 出发，只能向右或向下。`, view(-1, -1));
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      let msg;
      if (!i && !j) { dp[i][j] = g[0][0]; msg = `起点，dp = ${g[0][0]}。`; }
      else if (!i) { dp[i][j] = dp[i][j - 1] + g[i][j]; msg = `第一行只能从左边来：${dp[i][j - 1]} + ${g[i][j]} = <b>${dp[i][j]}</b>。`; }
      else if (!j) { dp[i][j] = dp[i - 1][j] + g[i][j]; msg = `第一列只能从上面来：${dp[i - 1][j]} + ${g[i][j]} = <b>${dp[i][j]}</b>。`; }
      else { const u = dp[i - 1][j], l = dp[i][j - 1]; dp[i][j] = Math.min(u, l) + g[i][j]; msg = `上面 ${u}，左边 ${l}，取小的 ${Math.min(u, l)}，加上自己 ${g[i][j]}，dp = <b>${dp[i][j]}</b>。`; }
      snap(`(${i}, ${j})`, msg, view(i, j));
    }
    let i = m - 1, j = n - 1; path = [[i, j]];
    while (i || j) { if (!i) j--; else if (!j) i--; else if (dp[i - 1][j] <= dp[i][j - 1]) i--; else j--; path.unshift([i, j]); }
    snap("完成", `最小路径和是 <b>${dp[m - 1][n - 1]}</b>，路径是 ${path.map(([x, y]) => g[x][y]).join(" → ")}。`, view(-1, -1), { kind: "ok", ans: dp[m - 1][n - 1] });
  },
  points: [
    { t: "边界单独处理", body: "第一行和第一列只有一个来源。用 inf 填充边界也可以省掉特判。" },
    { t: "可以原地修改", body: "直接把 grid 当 dp 用，空间 O(1)，但会改掉输入。" },
    { t: "复杂度", body: "时间 O(m·n)，一行滚动时空间 O(n)。" },
  ],
};
