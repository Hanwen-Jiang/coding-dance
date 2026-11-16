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
` }, { t: "简洁写法：两个变量滚动", kind: "elegant", note: "prev 是 dp[i-2]，cur 是 dp[i-1]。", code: `
class Solution:
    def rob(self, nums: List[int]) -> int:
        prev = cur = 0
        for x in nums:
            prev, cur = cur, max(cur, prev + x)
        return cur
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
  legend: [["a", "正在算的"], ["e", "用到的两项"], ["b", "第 i 间房"], ["c", "答案"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3, 1] }, note: "nums = [1,2,3,1]", expect: 4 },
    { label: "示例 2", args: { nums: [2, 7, 9, 3, 1] }, note: "nums = [2,7,9,3,1]", expect: 12 },
  ],
  build(a, snap) {
    const nums = a.nums, n = nums.length, dp = Array(n + 1).fill(null);
    dp[0] = 0; dp[1] = nums[0];
    const view = (i, fin) => [
      { t: "array", label: "nums（第 1 间到第 n 间）", idxFrom: 1, items: nums.map((v, k) => ({ v, cls: k === i - 1 ? "b" : "" })), ptrs: {} },
      { t: "array", label: "dp[i]：前 i 间最多偷多少", items: dp.map((v, k) => ({ v, cls: fin && k === n ? "c" : k === i ? "a" : i >= 0 && (k === i - 1 || k === i - 2) ? "e" : "" })), ptrs: { i: i >= 0 ? i : null } },
    ];
    snap("开始", `dp[0] = 0（没有房子），dp[1] = ${nums[0]}（只有第 1 间，偷了）。`, view(-1), { at: "init" });
    for (let i = 2; i <= n; i++) {
      const no = dp[i - 1], yes = dp[i - 2] + nums[i - 1];
      dp[i] = Math.max(no, yes);
      snap(`第 ${i} 间`, `不偷第 ${i} 间：dp[${i - 1}] = ${no}。偷第 ${i} 间：dp[${i - 2}] + ${nums[i - 1]} = ${yes}。取大的，dp[${i}] = <b>${dp[i]}</b>${yes > no ? "，偷" : "，不偷"}。`, view(i), { at: "step", facts: [["不偷", no], ["偷", yes]] });
    }
    snap("完成", `${n} 间房最多能偷 <b>${dp[n]}</b>。`, view(-1, true), { at: "done", kind: "ok", ans: dp[n] });
  },
  points: [
    { t: "dp 多开一位", body: "dp 长度 n + 1，dp[i] 对应前 i 间房，dp[0] = 0 可以省掉边界判断。" },
    { t: "不是隔一间偷一间", body: "最优方案可能隔两间，比如 [2,1,1,2] 偷第 1 和第 4 间。所以要用 DP，不能只比奇偶位置。" },
    { t: "复杂度", body: "时间 O(n)，滚动变量写法空间 O(1)。" },
  ],
};
