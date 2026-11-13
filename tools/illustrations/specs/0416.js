module.exports = {
  id: 416, name: "分割等和子集", title: "分割等和子集图解", level: "中等", topic: "动态规划",
  h1: "分割等和子集，能不能凑出总和的一半",
  lede: "分成和相等的两份，等价于能不能挑出一些数，和正好是总和的一半。这是 0-1 背包：每个数选或不选，问能否凑出 target。",
  hints: [
    { t: "转化问题", body: ["总和是奇数，直接返回 False。", "否则 <code>target = total // 2</code>，问：能不能从数组里挑一些数，和恰好是 <code>target</code>。"] },
    { t: "定义状态", body: ["<code>dp[j]</code>：用目前处理过的数，能不能凑出和 <code>j</code>。<code>dp[0] = True</code>。", "每来一个数 <code>x</code>：<code>dp[j] = dp[j] or dp[j - x]</code>，不选 x 或选 x。"] },
    { t: "为什么要倒着更新", body: ["一维数组里，<code>j</code> 从大到小更新，用到的 <code>dp[j - x]</code> 还是加入 x 之前的值，保证 x 只用一次。", "正着更新的话，x 会被用很多次，变成完全背包。"] },
  ],
  codes: [{ t: "标准解法：0-1 背包", code: `
class Solution:
    def canPartition(self, nums: List[int]) -> bool:
        total = sum(nums)
        if total % 2:
            return False
        target = total // 2
        dp = [True] + [False] * target      # dp[j]：能不能凑出和 j
        for x in nums:
            for j in range(target, x - 1, -1):  # 倒序：每个数只用一次
                dp[j] = dp[j] or dp[j - x]
        return dp[target]
` }, { t: "简洁写法：位运算", kind: "elegant", note: "bits 的第 j 位是 1 表示能凑出和 j。加入 x 就是把所有能凑出的和都加上 x：bits | (bits << x)。", code: `
class Solution:
    def canPartition(self, nums: List[int]) -> bool:
        total, bits = sum(nums), 1
        for x in nums:
            bits |= bits << x
        return total % 2 == 0 and (bits >> (total // 2)) & 1 == 1
` }],
  pytest: `
s = Solution()
assert s.canPartition([1,5,11,5]) is True
assert s.canPartition([1,2,3,5]) is False
assert s.canPartition([1,2,5]) is False
assert s.canPartition([2,2]) is True
assert s.canPartition([1]) is False
assert s.canPartition([100]*200) is True
`,
  legend: [["k", "能凑出"], ["c", "这一轮新能凑出的"], ["a", "目标 target"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 5, 11, 5] }, note: "nums = [1,5,11,5]", expect: true },
    { label: "凑不出", args: { nums: [1, 2, 5] }, note: "nums = [1,2,5]", expect: false },
    { label: "总和是奇数", args: { nums: [1, 2, 3, 5] }, note: "nums = [1,2,3,5]", expect: false },
  ],
  build(a, snap) {
    const nums = a.nums, total = nums.reduce((s, x) => s + x, 0);
    if (total % 2) { snap("总和是奇数", `总和 ${total} 是奇数，不可能分成相等的两份，返回 <b>false</b>。`, [{ t: "array", label: "nums", items: nums, ptrs: {} }], { kind: "warn", ans: false, facts: [["总和", total]] }); return; }
    const T = total / 2; let dp = Array(T + 1).fill(false); dp[0] = true;
    const view = (xi, fresh) => [
      { t: "array", label: "nums", items: nums.map((v, k) => ({ v, cls: k === xi ? "a" : k < xi ? "d" : "" })), ptrs: {} },
      { t: "array", label: `dp[j]：能不能凑出和 j（target = ${T}）`, items: dp.map((v, j) => ({ v: v ? "✓" : "", cls: fresh.includes(j) ? "c" : v ? "k" : j === T ? "e" : "" })), ptrs: { target: T } },
    ];
    snap("开始", `总和 ${total}，目标是挑出和为 <b>${T}</b> 的一些数。dp[0] = ✓：什么都不选，和为 0。`, view(-1, []), { facts: [["总和", total], ["target", T]] });
    for (let k = 0; k < nums.length; k++) {
      const x = nums[k], nd = dp.slice(), fresh = [];
      for (let j = T; j >= x; j--) if (!dp[j] && dp[j - x]) { nd[j] = true; fresh.push(j); }
      dp = nd;
      snap(`加入 ${x}`, fresh.length ? `原来能凑出的和都加上 ${x}，新能凑出 ${fresh.slice().reverse().join("、")}。` + (dp[T] ? `其中有 ${T}，找到了。` : "") : `加上 ${x} 后没有新的和（超过 ${T} 的不用管）。`, view(k, fresh), { facts: [["总和", total], ["target", T]] });
      if (dp[T]) { snap("完成", `能凑出 ${T}，可以分成两份，返回 <b>true</b>。`, view(-1, []), { kind: "ok", ans: true, facts: [["总和", total], ["target", T]] }); return; }
    }
    snap("完成", `所有数都加完了，还是凑不出 ${T}，返回 <b>false</b>。`, view(-1, []), { kind: "warn", ans: false, facts: [["总和", total], ["target", T]] });
  },
  points: [
    { t: "先判奇偶", body: "总和是奇数时直接返回 False，省掉后面所有计算。" },
    { t: "内层倒序", body: "<code>range(target, x - 1, -1)</code>。这是 0-1 背包一维写法最关键的一点。" },
    { t: "复杂度", body: "时间 O(n × target)，空间 O(target)。" },
  ],
};
