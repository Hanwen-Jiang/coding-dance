module.exports = {
  id: 198, name: "打家劫舍", title: "打家劫舍图解", level: "中等", topic: "动态规划",
  h1: "打家劫舍，第 i 间偷还是不偷",
  lede: "看最后一间房：不偷它，答案就是前 i − 1 间的最优值；偷它，前一间就不能偷，答案是前 i − 2 间的最优值加上这一间的钱。两者取大。",
  hints: [
    { t: "定义状态", body: ["<code>dp[i]</code>：只考虑前 <code>i</code> 间房，最多能偷多少钱。"] },
    { t: "最后一间偷不偷", body: ["不偷第 <code>i</code> 间：<code>dp[i - 1]</code>。", "偷第 <code>i</code> 间：第 <code>i - 1</code> 间不能偷，<code>dp[i - 2] + nums[i - 1]</code>。", "<code>dp[i] = max(dp[i - 1], dp[i - 2] + nums[i - 1])</code>。"] },
    { t: "初始值和空间优化", body: ["<code>dp[0] = 0</code>，<code>dp[1] = nums[0]</code>。", "只用到前两项，可以用两个变量滚动。"] },
  ],
  codes: [{ t: "标准解法：动态规划", code: `
class Solution:
    def rob(self, nums: List[int]) -> int:
        n = len(nums)                   #@init
        dp = [0] * (n + 1)              # dp[i]：前 i 间房最多偷多少 #@init
        dp[1] = nums[0]                 #@init
        for i in range(2, n + 1):
            dp[i] = max(dp[i - 1],                  # 不偷第 i 间 #@step
                        dp[i - 2] + nums[i - 1])    # 偷第 i 间 #@step
        return dp[n]                    #@done
` }, { t: "简洁写法：两个变量滚动（空间压缩）", key: "roll", kind: "elegant", note: "prev 是 dp[i-2]，cur 是 dp[i-1]。一开始两个都是 0：cur 是 dp[0]（没有房子），prev 是越界的 dp[-1]，也当成 0。空间 O(1)。", code: `
class Solution:
    def rob(self, nums: List[int]) -> int:
        prev = cur = 0                      # dp[-1]（越界）和 dp[0]（没有房子），都是 0 #@init
        for x in nums:                      #@step
            prev, cur = cur, max(cur, prev + x)     # 不偷：cur；偷：prev + x #@step
        return cur                          #@done
` }],
  pytest: `
s = Solution()
assert s.rob([1,2,3,1]) == 4
assert s.rob([2,7,9,3,1]) == 12
assert s.rob([5]) == 5
assert s.rob([2,1,1,2]) == 4
`,
  sig: { fn: "rob", params: ["int[]"], ret: "int" },
  call: (a) => [a.nums],
  cases: [[[5]], [[0]], [[2, 1]], [[2, 1, 1, 2]]],
  legend: [["a", "正在算的"], ["e", "用到的两项"], ["b", "第 i 间房"], ["x", "边界：直接给定，不用算"], ["c", "答案"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3, 1] }, note: "nums = [1,2,3,1]", expect: 4 },
    { label: "示例 2", args: { nums: [2, 7, 9, 3, 1] }, note: "nums = [2,7,9,3,1]", expect: 12 },
  ],
  build(a, snap) {
    const nums = a.nums, n = nums.length, dp = Array(n + 1).fill(null);
    dp[0] = 0; dp[1] = nums[0];
    const view = (i, fin) => [
      { t: "array", label: "nums（第 1 间到第 n 间）", idxFrom: 1, items: nums.map((v, k) => ({ v, cls: k === i - 1 ? "b" : "" })), ptrs: {} },
      // dp[0]、dp[1] 是边界（虚线）：直接给定，公式从 dp[2] 开始才用
      { t: "array", label: "dp[i]：前 i 间最多偷多少", items: dp.map((v, k) => {
        const used = i >= 0 && (k === i - 1 || k === i - 2);
        return { v, cls: fin && k === n ? "c" : k === i ? "a" : k < 2 ? (used ? "x e" : "x") : used ? "e" : "" };
      }), ptrs: { i: i >= 0 ? i : null } },
    ];
    snap("边界", `dp[0] = 0：一间房都没有，偷不到钱。dp[1] = ${nums[0]}：只有第 1 间，偷了最多。<br>dp 多开一位（dp[0]），算 dp[2] 时用到的 dp[i − 2] 才不会越界。`, view(-1), { at: "init" });
    for (let i = 2; i <= n; i++) {
      const no = dp[i - 1], yes = dp[i - 2] + nums[i - 1];
      dp[i] = Math.max(no, yes);
      snap(`第 ${i} 间`, `不偷第 ${i} 间：dp[${i - 1}] = ${no}。偷第 ${i} 间：dp[${i - 2}] + ${nums[i - 1]} = ${yes}。取大的，dp[${i}] = <b>${dp[i]}</b>${yes > no ? "，偷" : "，不偷"}。`, view(i), { at: "step", facts: [["不偷", no], ["偷", yes]] });
    }
    snap("完成", `${n} 间房最多能偷 <b>${dp[n]}</b>。`, view(-1, true), { at: "done", kind: "ok", ans: dp[n] });
  },
  alts: [{
    t: "两个变量滚动（空间压缩）",
    code: "roll",
    note: "算 dp[i] 只用到 dp[i − 1] 和 dp[i − 2]，所以只用两个变量：prev 是 dp[i − 2]，cur 是 dp[i − 1]。一开始 cur 是 dp[0] = 0（没有房子），prev 是越界的 dp[−1]，也当成 0：这样第 1 间房也能用同一个公式。",
    legend: [["b", "这一间房"], ["e", "prev"], ["a", "cur"], ["d", "已经丢掉、不再保存的"], ["x", "越界或边界"]],
    build(a, snap) {
      const nums = a.nums, n = nums.length, vals = [0, 0];   // vals[p + 1] 是 dp[p]，dp[-1] 也当成 0
      let k = 0;                                              // 下一间要处理的房子（下标）；cur 是 dp[k]，prev 是 dp[k - 1]
      const view = (fin) => [
        { t: "array", label: "nums（第 1 间到第 n 间）", idxFrom: 1, items: nums.map((v, t) => ({ v, cls: t === k - 1 && !fin ? "b" : t < k - 1 ? "d" : "" })) },
        {
          t: "array", label: "dp（灰色是已经丢掉的，代码里只存 prev、cur 两个数；-1 是越界）", labels: Array.from({ length: n + 2 }, (_, t) => t - 1),
          items: Array.from({ length: n + 2 }, (_, t) => {
            const p = t - 1;
            return { v: t < vals.length ? vals[t] : "", cls: fin && p === n ? "c" : p === k ? "a" : p === k - 1 ? (p <= 0 ? "x e" : "e") : p < k - 1 ? (p <= 0 ? "x d" : "d") : p <= 0 ? "x" : "" };
          }),
          ptrs: { prev: k, cur: k + 1 },
        },
        { t: "chips", label: "代码里只有这两个变量", items: [{ v: `prev = ${vals[k]}（dp[${k - 1}]）`, cls: "e" }, { v: `cur = ${vals[k + 1]}（dp[${k}]）`, cls: "a" }] },
      ];
      snap("开始", "prev、cur 一开始都是 0：cur 是 dp[0]（没有房子），prev 是 dp[−1]，越界了，也当成 0（前 −1 间房当然也偷不到钱）。", view(false), { at: "init" });
      for (const x of nums) {
        const no = vals[k + 1], yes = vals[k] + x;
        vals.push(Math.max(no, yes)); k++;
        snap(`第 ${k} 间`, `不偷第 ${k} 间：cur = ${no}；偷：prev + ${x} = ${yes}。新的 cur = <b>${Math.max(no, yes)}</b>（dp[${k}]），prev 变成原来的 cur（dp[${k - 1}]）。`, view(false), { at: "step" });
      }
      snap("完成", `cur = dp[${n}] = <b>${vals[n + 1]}</b>。只用了两个变量，空间 O(1)。`, view(true), { at: "done", kind: "ok", ans: vals[n + 1] });
    },
  }],
  points: [
    { t: "dp 多开一位", body: "dp 长度 n + 1，dp[i] 对应前 i 间房，dp[0] = 0 可以省掉边界判断。" },
    { t: "不是隔一间偷一间", body: "最优方案可能隔两间，比如 [2,1,1,2] 偷第 1 和第 4 间。所以要用 DP，不能只比奇偶位置。" },
    { t: "复杂度", body: "时间 O(n)，滚动变量写法空间 O(1)。" },
  ],
};
