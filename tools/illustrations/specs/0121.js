module.exports = {
  id: 121, name: "买卖股票的最佳时机", title: "买卖股票的最佳时机图解", level: "简单", topic: "贪心算法",
  h1: "买卖股票，在之前最便宜的那天买",
  lede: "假设今天卖出，那么最好的买入日就是今天之前价格最低的那天。从左往右走，一边记住到目前为止的最低价，一边算今天卖能赚多少，取最大值。",
  hints: [
    { t: "固定卖出的那天", body: ["如果第 <code>i</code> 天卖出，最多能赚 <code>prices[i] - min(prices[0..i])</code>。", "把每一天都当一次卖出日，取最大值就是答案。"] },
    { t: "最低价不用每次重新算", body: ["从左往右走时，用一个变量 <code>min_price</code> 记住走过的最低价，每天更新一次。"] },
    { t: "不赚钱就不交易", body: ["价格一直下跌时，每天卖出都是亏的。答案初始为 0，相当于不交易。"] },
  ],
  codes: [{ t: "标准解法：一次遍历", code: `
class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        min_price, best = float("inf"), 0  #@init
        for p in prices:
            min_price = min(min_price, p)       # 到今天为止的最低价 #@low
            best = max(best, p - min_price)     # 今天卖出能赚多少 #@sell
        return best                         #@done
` }, { t: "简洁写法：前缀最小值", kind: "elegant", note: "accumulate(prices, min) 生成每一天之前（含当天）的最低价。", code: `
from itertools import accumulate

class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        return max(p - m for p, m in zip(prices, accumulate(prices, min)))
` }],
  sig: { fn: "maxProfit", params: ["int[]"], ret: "int" },
  call: (a) => [a.prices],
  cases: [[[1]], [[2, 4, 1]], [[1, 2]], [[2, 1]]],
  pytest: `
s = Solution()
assert s.maxProfit([7,1,5,3,6,4]) == 5
assert s.maxProfit([7,6,4,3,1]) == 0
assert s.maxProfit([1]) == 0
assert s.maxProfit([2,4,1]) == 2
assert s.maxProfit([3,2,6,5,0,3]) == 4
`,
  legend: [["b", "目前的最低价"], ["a", "今天"], ["c", "最佳的一笔"]],
  presets: [
    { label: "示例 1", args: { prices: [7, 1, 5, 3, 6, 4] }, note: "prices = [7,1,5,3,6,4]", expect: 5 },
    { label: "示例 2", args: { prices: [7, 6, 4, 3, 1] }, note: "prices = [7,6,4,3,1]", expect: 0 },
    { label: "最低价在后面", args: { prices: [3, 2, 6, 5, 0, 3] }, note: "prices = [3,2,6,5,0,3]", expect: 4 },
  ],
  build(a, snap) {
    const P = a.prices; let mi = -1, best = 0, bb = -1, bs = -1;
    const view = (i, fin) => [{ t: "bars", label: "prices", items: P.map((v, k) => ({ v, cls: fin ? (k === bb || k === bs ? "c" : "") : k === i ? "a" : k === mi ? "b" : k > i ? "d" : "" })), ptrs: { 今天: fin ? null : i, 最低: !fin && mi >= 0 && mi !== i ? mi : null } }];
    const f = () => ({ facts: [["最低价", mi >= 0 ? P[mi] : "—"], ["最大利润", best]] });
    snap("开始", "从第 0 天开始，每一天都假设自己在这天卖出。", view(-1), { at: "init", ...f() });
    P.forEach((p, i) => {
      if (mi < 0 || p < P[mi]) { mi = i; snap("新低", `第 ${i} 天价格 ${p}，比之前都低，记成最低价。今天买今天卖赚 0。`, view(i), { at: "low", ...f() }); return; }
      const g = p - P[mi];
      if (g > best) { best = g; bb = mi; bs = i; snap("更好的一笔", `第 ${i} 天卖出：${p} − ${P[mi]} = <b>${g}</b>，比之前的都多，更新答案。`, view(i), { at: "sell", ...f() }); }
      else snap("卖出试试", `第 ${i} 天卖出：${p} − ${P[mi]} = ${g}，没有超过 ${best}。`, view(i), { at: "sell", ...f() });
    });
    snap("完成", best ? `最大利润是 <b>${best}</b>：第 ${bb} 天以 ${P[bb]} 买入，第 ${bs} 天以 ${P[bs]} 卖出。` : "每天卖出都不赚钱，不交易，利润 <b>0</b>。", view(-1, true), { at: "done", kind: "ok", ans: best, ...f() });
  },
  points: [
    { t: "先更新最低价再算利润", body: "两句顺序反过来也对，因为当天买当天卖利润是 0，不会影响答案。" },
    { t: "不能先卖后买", body: "所以不能直接用「最大值 − 最小值」，最小值必须出现在最大值之前。" },
    { t: "复杂度", body: "一遍扫描，时间 O(n)，空间 O(1)。" },
  ],
};
