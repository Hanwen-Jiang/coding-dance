module.exports = {
  id: 279, name: "完全平方数", title: "完全平方数图解", level: "中等", topic: "动态规划",
  h1: "完全平方数，枚举最后一个平方数",
  lede: "和为 i 的最少平方数个数：最后一个平方数可以是 1、4、9……只要不超过 i。选了 j²，剩下的 i − j² 用最少的个数凑出来，再加上这一个。所有 j 里取最小。",
  hints: [
    { t: "定义状态", body: ["<code>dp[i]</code>：和为 <code>i</code> 的完全平方数最少有几个。<code>dp[0] = 0</code>。"] },
    { t: "枚举最后一个数", body: ["最后一个数是 <code>j²</code>（<code>j² &lt;= i</code>），那么 <code>dp[i] = dp[i - j²] + 1</code>。", "对所有 <code>j</code> 取最小。"] },
    { t: "像零钱兑换", body: ["把 1、4、9、16……看成面值，每种可以用无数次，问凑出 n 最少几枚。和第 322 题是同一个模型。"] },
  ],
  codes: [{ t: "标准解法：动态规划", code: `
class Solution:
    def numSquares(self, n: int) -> int:
        dp = [0] + [float("inf")] * n       # dp[i]：和为 i 最少几个平方数
        for i in range(1, n + 1):
            j = 1
            while j * j <= i:
                dp[i] = min(dp[i], dp[i - j * j] + 1)   # 最后一个数取 j²
                j += 1
        return dp[n]
` }, { t: "简洁写法：min 生成式", kind: "elegant", code: `
from math import isqrt

class Solution:
    def numSquares(self, n: int) -> int:
        dp = [0] * (n + 1)
        for i in range(1, n + 1):
            dp[i] = 1 + min(dp[i - j * j] for j in range(1, isqrt(i) + 1))
        return dp[n]
` }, { t: "进阶：四平方和定理", note: "任何正整数都能写成 4 个平方数之和，所以答案只可能是 1 到 4。形如 4ᵃ(8b + 7) 的数恰好需要 4 个。", code: `
from math import isqrt

class Solution:
    def numSquares(self, n: int) -> int:
        is_sq = lambda x: isqrt(x) ** 2 == x
        if is_sq(n):
            return 1
        while n % 4 == 0:
            n //= 4
        if n % 8 == 7:
            return 4
        if any(is_sq(n - i * i) for i in range(1, isqrt(n) + 1)):
            return 2
        return 3
` }],
  pytest: `
s = Solution()
assert s.numSquares(12) == 3
assert s.numSquares(13) == 2
assert s.numSquares(1) == 1
assert s.numSquares(7) == 4
assert s.numSquares(43) == 3
assert [s.numSquares(i) for i in range(1, 30)] == [1,2,3,1,2,3,4,2,1,2,3,3,2,3,4,1,2,2,3,2,3,3,4,3,1,2,3,4,2]
`,
  legend: [["a", "正在算的"], ["e", "候选 dp[i − j²]"], ["c", "取到最小的那个"]],
  presets: [
    { label: "n = 12", args: { n: 12 }, note: "n = 12", expect: 3 },
    { label: "n = 13", args: { n: 13 }, note: "n = 13", expect: 2 },
  ],
  build(a, snap) {
    const n = a.n, dp = Array(n + 1).fill(null); dp[0] = 0;
    const view = (i, cands, best, fin) => [{ t: "array", label: "dp[i]：和为 i 最少几个平方数", items: dp.map((v, k) => ({ v, cls: fin && k === n ? "c" : k === i ? "a" : k === best ? "c" : cands.includes(k) ? "e" : "" })), ptrs: { i: i >= 0 ? i : null } }];
    snap("开始", "dp[0] = 0：和为 0 不需要任何数。", view(-1, [], -1));
    for (let i = 1; i <= n; i++) {
      const cs = []; let best = Infinity, bk = -1, parts = [];
      for (let j = 1; j * j <= i; j++) { const k = i - j * j; cs.push(k); parts.push(`${j * j}：dp[${k}] + 1 = ${dp[k] + 1}`); if (dp[k] + 1 < best) { best = dp[k] + 1; bk = k; } }
      dp[i] = best;
      snap(`dp[${i}]`, `最后一个数可以是 ${parts.join("；")}。最小的是 <b>${best}</b>。`, view(i, cs, bk), { facts: [["dp[" + i + "]", best]] });
    }
    snap("完成", `和为 ${n} 最少需要 <b>${dp[n]}</b> 个完全平方数。`, view(-1, [], -1, true), { kind: "ok", ans: dp[n] });
  },
  points: [
    { t: "初始化成无穷大", body: "dp[1..n] 初始化成 inf，取 min 才有意义。dp[0] = 0 是唯一的起点。" },
    { t: "答案最多是 4", body: "四平方和定理保证了这一点，所以 BFS 写法最多扩展 4 层。" },
    { t: "复杂度", body: "DP 时间 O(n√n)，空间 O(n)。四平方和定理写法时间 O(√n)。" },
  ],
};
