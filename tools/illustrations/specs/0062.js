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
    const view = (ci, cj, fin) => [{ t: "grid", label: "dp[i][j]：从左上走到 (i, j) 的路径数", rows: dp.map((r, i) => r.map((v, j) => ({ v: v === null ? "" : v, cls: fin && i === m - 1 && j === n - 1 ? "c" : i === ci && j === cj ? "a" : (i === ci - 1 && j === cj) || (i === ci && j === cj - 1) ? "e" : "" }))) }];
    snap("开始", "第一行只能一直向右走，第一列只能一直向下走，路径数都是 1。", view(-1, -1), { at: "init" });
    for (let i = 1; i < m; i++) for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
      snap(`(${i}, ${j})`, `从上面 (${i - 1}, ${j}) 来有 ${dp[i - 1][j]} 种，从左边 (${i}, ${j - 1}) 来有 ${dp[i][j - 1]} 种。dp = <b>${dp[i][j]}</b>。`, view(i, j), { at: "cell" });
    }
    snap("完成", `到右下角一共 <b>${dp[m - 1][n - 1]}</b> 条路径。`, view(-1, -1, true), { at: "done", kind: "ok", ans: dp[m - 1][n - 1] });
  },
  points: [
    { t: "可以压成一行", body: "<code>dp[j] += dp[j-1]</code>：更新前的 dp[j] 是上面的值，dp[j-1] 是刚更新过的左边的值。" },
    { t: "组合数不会溢出", body: "Python 的整数没有上限，Java 里要用 long 并且边乘边除。" },
    { t: "复杂度", body: "DP 时间 O(m·n)；组合数 O(min(m, n))。" },
  ],
};
