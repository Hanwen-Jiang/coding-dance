module.exports = {
  id: 300, name: "最长递增子序列", title: "最长递增子序列图解", level: "中等", topic: "动态规划",
  h1: "最长递增子序列，以谁结尾",
  lede: "dp[i] 记以 nums[i] 结尾的最长递增子序列长度。nums[i] 可以接在前面任何一个比它小的数后面，接在哪个后面最长，就选哪个。",
  hints: [
    { t: "定义状态要带上结尾", body: ["只说「前 i 个数的 LIS 长度」没法转移，因为不知道最后一个数是多少，新数接不接得上。", "改成 <code>dp[i]</code>：<strong>以 <code>nums[i]</code> 结尾</strong>的最长递增子序列长度。"] },
    { t: "转移", body: ["对所有 <code>j &lt; i</code> 且 <code>nums[j] &lt; nums[i]</code>，<code>dp[i] = max(dp[j] + 1)</code>。没有这样的 j 时 <code>dp[i] = 1</code>。", "答案是 <code>max(dp)</code>，不是 <code>dp[-1]</code>。"] },
    { t: "进阶：O(n log n)", body: ["维护 <code>tails[k]</code>：长度为 <code>k + 1</code> 的递增子序列里，结尾最小是多少。<code>tails</code> 是递增的。", "每来一个数 x，二分找到第一个 ≥ x 的位置替换掉；没有就接在末尾。最后 <code>tails</code> 的长度就是答案。"] },
  ],
  codes: [{ t: "标准解法：动态规划 O(n²)", code: `
class Solution:
    def lengthOfLIS(self, nums: List[int]) -> int:
        dp = [1] * len(nums)                # dp[i]：以 nums[i] 结尾的 LIS 长度
        for i in range(len(nums)):
            for j in range(i):
                if nums[j] < nums[i]:
                    dp[i] = max(dp[i], dp[j] + 1)   # 接在 nums[j] 后面
        return max(dp)
` }, { t: "简洁写法：贪心 + 二分 O(n log n)", kind: "elegant", note: "tails[k:k+1] = [x]：k 等于长度时相当于 append，否则替换掉更大的结尾。", code: `
from bisect import bisect_left

class Solution:
    def lengthOfLIS(self, nums: List[int]) -> int:
        tails = []                          # tails[k]：长度 k+1 的递增子序列的最小结尾
        for x in nums:
            k = bisect_left(tails, x)
            tails[k:k + 1] = [x]
        return len(tails)
` }],
  pytest: `
s = Solution()
assert s.lengthOfLIS([10,9,2,5,3,7,101,18]) == 4
assert s.lengthOfLIS([0,1,0,3,2,3]) == 4
assert s.lengthOfLIS([7,7,7,7,7,7,7]) == 1
assert s.lengthOfLIS([1]) == 1
assert s.lengthOfLIS([4,10,4,3,8,9]) == 3
`,
  method: "动态规划 O(n²)",
  legend: [["a", "正在算的 nums[i]"], ["e", "比它小、可以接的"], ["c", "接上后最长的那个"]],
  presets: [
    { label: "示例 1", args: { nums: [10, 9, 2, 5, 3, 7, 101, 18] }, note: "nums = [10,9,2,5,3,7,101,18]", expect: 4 },
    { label: "示例 2", args: { nums: [0, 1, 0, 3, 2, 3] }, note: "nums = [0,1,0,3,2,3]", expect: 4 },
  ],
  build(a, snap) {
    const nums = a.nums, n = nums.length, dp = Array(n).fill(null);
    const view = (i, cand, from) => [
      { t: "array", label: "nums", items: nums.map((v, k) => ({ v, cls: k === i ? "a" : k === from ? "c" : cand.includes(k) ? "e" : "" })), ptrs: { i: i >= 0 ? i : null } },
      { t: "array", label: "dp[i]：以 nums[i] 结尾的 LIS 长度", items: dp.map((v, k) => ({ v: v === null ? "" : v, cls: k === i ? "a" : k === from ? "c" : "" })), ptrs: {} },
    ];
    snap("开始", "从左往右，算出以每个数结尾的最长递增子序列。", view(-1, [], -1));
    for (let i = 0; i < n; i++) {
      const cand = []; let best = 1, from = -1;
      for (let j = 0; j < i; j++) if (nums[j] < nums[i]) { cand.push(j); if (dp[j] + 1 > best) { best = dp[j] + 1; from = j; } }
      dp[i] = best;
      snap(`dp[${i}]`, cand.length ? `前面比 ${nums[i]} 小的有 ${cand.map((j) => nums[j]).join("、")}。接在 ${nums[from]} 后面最长（dp[${from}] = ${dp[from]}），dp[${i}] = <b>${best}</b>。` : `前面没有比 ${nums[i]} 小的数，它只能自己开头，dp[${i}] = <b>1</b>。`, view(i, cand, from), { facts: [["目前最长", Math.max(...dp.filter((v) => v !== null))]] });
    }
    const ans = Math.max(...dp);
    snap("完成", `答案是 dp 里的最大值 <b>${ans}</b>，不一定是最后一个。`, view(-1, [], -1), { kind: "ok", ans, facts: [["目前最长", ans]] });
  },
  alts: [{
    t: "贪心 + 二分",
    note: "和简洁写法一样：tails[k] 记「长度为 k+1 的递增子序列，结尾最小可以是多少」。新数比所有结尾都大就接在最后；否则用二分找到第一个 ≥ 它的结尾，换成它。",
    legend: [["a", "当前的数"], ["c", "接在最后，长度 +1"], ["w", "换成更小的结尾"]],
    build(a, snap) {
      const nums = a.nums, n = nums.length, tails = [];
      const view = (i, k, mode) => [
        { t: "array", label: "nums", items: nums.map((v, t) => ({ v, cls: t === i ? "a" : t < i ? "d" : "" })), ptrs: { i: i >= 0 && i < n ? i : null } },
        tails.length
          ? { t: "array", label: "tails[k]：长度为 k+1 的递增子序列的最小结尾", items: tails.map((v, t) => ({ v, cls: t === k ? (mode === "add" ? "c" : "w") : "" })) }
          : { t: "note", label: "tails", html: "空" },
      ];
      const f = () => ({ facts: [["最长", tails.length]] });
      snap("开始", "tails 一开始是空的。它始终是递增的，所以可以二分。", view(-1, -1), f());
      for (let i = 0; i < n; i++) {
        const x = nums[i];
        let lo = 0, hi = tails.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
        if (lo === tails.length) {
          tails.push(x);
          snap("接到最后", `${x} 比 tails 里所有结尾都大，接在最长的那个后面。现在最长是 <b>${tails.length}</b>。`, view(i, lo, "add"), f());
        } else {
          const old = tails[lo]; tails[lo] = x;
          snap("替换", `二分找到第一个 ≥ ${x} 的位置 k = ${lo}（原来是 ${old}）。长度为 ${lo + 1} 的递增子序列，结尾可以从 ${old} 换成更小的 ${x}，后面更容易接上新数。`, view(i, lo, "rep"), f());
        }
      }
      snap("完成", `答案是 tails 的长度 <b>${tails.length}</b>。注意 tails 本身不一定是一个真正的递增子序列，只有长度是对的。`, view(n, -1), { kind: "ok", ans: tails.length, ...f() });
    },
  }],
  points: [
    { t: "严格递增", body: "判断条件是 <code>nums[j] &lt; nums[i]</code>，相等不能接。二分写法对应用 bisect_left。" },
    { t: "答案是 max(dp)", body: "最长的子序列可能在中间结束，比如 [1,2,0]。" },
    { t: "复杂度", body: "DP 写法 O(n²)；tails 写法每个数二分一次，O(n log n)。" },
  ],
};
