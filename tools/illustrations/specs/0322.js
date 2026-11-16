module.exports = {
  id: 322, name: "零钱兑换", title: "零钱兑换图解", level: "中等", topic: "动态规划",
  h1: "零钱兑换，最后一枚硬币用哪种",
  lede: "凑出金额 i，最后一枚硬币可能是任意一种面值 c。用了 c，剩下的 i − c 要用最少的硬币凑出来。对所有面值取最小，就是 dp[i]。",
  hints: [
    { t: "贪心为什么不行", body: ["每次拿最大面值不一定最优：<code>coins = [1, 3, 4]</code>、<code>amount = 6</code>，贪心拿 4+1+1 是 3 枚，最优是 3+3 两枚。"] },
    { t: "定义状态", body: ["<code>dp[i]</code>：凑出金额 <code>i</code> 最少要几枚硬币，凑不出来就是无穷大。<code>dp[0] = 0</code>。"] },
    { t: "枚举最后一枚", body: ["<code>dp[i] = min(dp[i - c] + 1)</code>，对所有 <code>c &lt;= i</code> 的面值取最小。", "最后 <code>dp[amount]</code> 还是无穷大，就返回 <code>-1</code>。"] },
  ],
  codes: [{ t: "标准解法：动态规划", code: `
class Solution:
    def coinChange(self, coins: List[int], amount: int) -> int:
        INF = float("inf")                  #@init
        dp = [0] + [INF] * amount           # dp[i]：凑出 i 最少几枚 #@init
        for i in range(1, amount + 1):
            for c in coins:
                if c <= i and dp[i - c] + 1 < dp[i]:    #@try
                    dp[i] = dp[i - c] + 1   # 最后一枚用 c #@try
        return dp[amount] if dp[amount] != INF else -1  #@done
` }, { t: "简洁写法：完全背包", key: "knap", kind: "elegant", note: "外层枚举硬币、内层正序枚举金额，每种硬币可以被用无数次。", code: `
from math import inf

class Solution:
    def coinChange(self, coins: List[int], amount: int) -> int:
        dp = [0] + [inf] * amount           #@init
        for c in coins:                     #@coin
            for i in range(c, amount + 1):
                dp[i] = min(dp[i], dp[i - c] + 1)   #@upd
        return dp[amount] if dp[amount] < inf else -1   #@done
` }],
  pytest: `
s = Solution()
assert s.coinChange([1,2,5], 11) == 3
assert s.coinChange([2], 3) == -1
assert s.coinChange([1], 0) == 0
assert s.coinChange([1,3,4], 6) == 2
assert s.coinChange([186,419,83,408], 6249) == 20
`,
  sig: { fn: "coinChange", params: ["int[]", "int"], ret: "int" },
  call: (a) => [a.coins, a.amount],
  cases: [[[1], 0], [[2], 3], [[1, 3, 4], 6], [[186, 419, 83, 408], 6249], [[2147483647], 2], [[5, 3], 7]],
  method: "按金额递推",
  legend: [["a", "正在算的金额"], ["e", "候选 dp[i − c]"], ["c", "取到最小的那个"], ["x", "边界 / 越界"]],
  presets: [
    { label: "示例 1", args: { coins: [1, 2, 5], amount: 11 }, note: "coins = [1,2,5], amount = 11", expect: 3 },
    { label: "凑不出", args: { coins: [2], amount: 3 }, note: "coins = [2], amount = 3", expect: -1 },
    { label: "贪心会错", args: { coins: [1, 3, 4], amount: 6 }, note: "coins = [1,3,4], amount = 6", expect: 2 },
  ],
  build(a, snap) {
    const { coins, amount } = a, dp = Array(amount + 1).fill(null); dp[0] = 0;
    const show = (v) => (v === Infinity ? "∞" : v);
    // 最左边多画一格「下标 < 0」：面值比金额大时 i − c 是负数，越界，当成 ∞（这枚用不了）。dp[0] 是边界
    const view = (i, cands, best, fin, ghost) => [{
      t: "array", label: "dp[i]：凑出 i 最少几枚（虚线：dp[0] 是边界；最左边是越界的负下标，当成 ∞）", labels: ["<0", ...dp.map((_, k) => k)],
      items: [{ v: "∞", cls: ghost ? "x e" : "x" }, ...dp.map((v, k) => ({ v: v === null ? "" : show(v), cls: fin && k === amount ? "c" : k === i ? "a" : k === best ? "c" : cands.includes(k) ? (k === 0 ? "x e" : "e") : k === 0 ? "x" : "" }))],
      ptrs: { i: i >= 0 ? i + 1 : null },
    }];
    snap("边界", `面值有 [${coins.join(",")}]。dp[0] = 0：金额 0 不需要硬币，这是边界。其他金额先当成 ∞（还没凑出来）。<br>如果面值 c 比金额 i 大，dp[i − c] 的下标是负数，越界了：把它当成 ∞，这枚硬币就自然用不上。代码里用 c ≤ i 把它挡掉。`, view(-1, [], -1), { at: "init" });
    for (let i = 1; i <= amount; i++) {
      let best = Infinity, bk = -1; const cs = [], parts = [], over = [];
      for (const c of coins) if (c <= i) { cs.push(i - c); parts.push(`用 ${c}：dp[${i - c}] + 1 = ${show(dp[i - c] + 1)}`); if (dp[i - c] + 1 < best) { best = dp[i - c] + 1; bk = i - c; } } else over.push(c);
      dp[i] = best;
      const ov = over.length ? `面值 ${over.join("、")} 比 ${i} 大，i − c 越界，当成 ∞，用不了。` : "";
      snap(`金额 ${i}`, parts.length ? `最后一枚可以${parts.join("；")}。${ov}dp[${i}] = <b>${show(best)}</b>。` : `${ov}所有面值都用不了，凑不出来，dp[${i}] = ∞。`, view(i, cs, best === Infinity ? -1 : bk, false, over.length > 0), { at: "try", facts: [["dp[" + i + "]", show(best)]] });
    }
    const ans = dp[amount] === Infinity ? -1 : dp[amount];
    snap("完成", ans < 0 ? `dp[${amount}] 是 ∞，凑不出来，返回 <b>-1</b>。` : `凑出 ${amount} 最少要 <b>${ans}</b> 枚硬币。`, view(-1, [], -1, true), { at: "done", kind: ans < 0 ? "warn" : "ok", ans });
  },
  alts: [{
    t: "完全背包",
    code: "knap",
    note: "和简洁写法一样：外层一种一种地加入硬币，内层金额从小到大更新。正序更新时 dp[i − c] 可能刚用过面值 c，所以同一种硬币可以用很多枚。",
    legend: [["a", "正在算的金额 / 这一轮的面值"], ["e", "dp[i − c]"], ["c", "变少了，更新"]],
    build(a, snap) {
      const { coins, amount } = a, dp = Array(amount + 1).fill(Infinity); dp[0] = 0;
      const show = (v) => (v === Infinity ? "∞" : v);
      const view = (i, from, c, upd) => [
        { t: "array", label: "coins", items: coins.map((x) => ({ v: x, cls: x === c ? "a" : "" })), idx: false },
        { t: "array", label: "dp[i]：凑出 i 最少几枚", items: dp.map((v, k) => ({ v: show(v), cls: k === i ? (upd ? "c" : "a") : k === from ? "e" : "" })), ptrs: { i: i >= 0 ? i : null } },
      ];
      snap("开始", "dp[0] = 0，其他金额先设成 ∞。", view(-1, -1, null, false), { at: "init" });
      for (const c of coins) {
        const touched = new Set();
        snap(`加入面值 ${c}`, `现在允许用面值 ${c}，从金额 ${c} 开始往上更新。`, view(-1, -1, c, false), { at: "coin" });
        for (let i = c; i <= amount; i++) {
          const cand = dp[i - c] + 1, old = dp[i], upd = cand < old;
          if (upd) { dp[i] = cand; touched.add(i); }
          const reuse = touched.has(i - c) ? `（dp[${i - c}] 这一轮刚用 ${c} 更新过，相当于 ${c} 又用了一枚）` : "";
          snap(`面值 ${c}`, `金额 ${i}：最后一枚用 ${c}，要 dp[${i - c}] + 1 = ${show(cand)}${reuse}。` + (upd ? `比原来的 ${show(old)} 少，dp[${i}] 更新成 <b>${cand}</b>。` : `不比原来的 ${show(old)} 少，不变。`), view(i, i - c, c, upd), { at: "upd" });
        }
      }
      const ans = dp[amount] === Infinity ? -1 : dp[amount];
      snap("完成", ans < 0 ? `dp[${amount}] 还是 ∞，凑不出来，返回 <b>-1</b>。` : `凑出 ${amount} 最少要 <b>${ans}</b> 枚硬币。`, view(amount, -1, null, true), { at: "done", kind: ans < 0 ? "warn" : "ok", ans });
    },
  }],
  points: [
    { t: "初始化成无穷大", body: "不能初始化成 0 或 -1，否则取 min 时会出错。凑不出来的金额一直保持 inf。" },
    { t: "两层循环可以交换", body: "求最少枚数时，先枚举金额还是先枚举硬币都对。求组合数（第 518 题）时顺序就有讲究了。" },
    { t: "复杂度", body: "时间 O(amount × 面值种数)，空间 O(amount)。" },
  ],
};
