module.exports = {
  id: 53, name: "最大子数组和", title: "最大子数组和图解", level: "中等", topic: "普通数组",
  h1: "最大子数组和，前面是负担就甩掉",
  lede: "走到每个数时只做一个决定：接在前面那一段后面，还是从自己重新开始。如果前面那一段的和是负数，它只会拖后腿，不如重新开始。",
  hints: [
    { t: "以每个位置结尾来想", body: ["设 <code>cur</code> 是「以当前这个数结尾」的子数组的最大和。", "答案就是所有位置的 <code>cur</code> 里最大的那个。"] },
    { t: "只有两个选择", body: ["以 <code>x</code> 结尾的子数组，要么是 <code>x</code> 自己，要么是前一个位置的最优子数组再接上 <code>x</code>。", "所以 <code>cur = max(x, cur + x)</code>。"] },
    { t: "换句话说", body: ["前面的和 <code>cur</code> 如果是负数，接上它只会让结果更小，那就丢掉它从 <code>x</code> 重新开始。", "这就是 Kadane 算法。"] },
  ],
  codes: [{ t: "标准解法：动态规划（Kadane）", code: `
class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        cur = best = nums[0]            #@init
        for x in nums[1:]:
            cur = max(x, cur + x)       # 接上前面，或者重新开始 #@step
            best = max(best, cur)       #@step
        return best                     #@done
` }, { t: "简洁写法：原地累加", kind: "elegant", note: "nums[i] 变成「以 i 结尾的最大子数组和」：前面的和是负数就不要了。会改掉输入数组。", code: `
class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        for i in range(1, len(nums)):
            nums[i] += max(nums[i - 1], 0)
        return max(nums)
` }],
  pytest: `
s = Solution()
assert s.maxSubArray([-2,1,-3,4,-1,2,1,-5,4]) == 6
assert s.maxSubArray([1]) == 1
assert s.maxSubArray([5,4,-1,7,8]) == 23
assert s.maxSubArray([-3,-1,-2]) == -1
`,
  sig: { fn: "maxSubArray", params: ["int[]"], ret: "int" },
  call: (a) => [a.nums],
  cases: [[[1]], [[-1]], [[5, 4, -1, 7, 8]], [[-2, -3, -1, -5]]],
  legend: [["e", "当前这一段"], ["a", "当前的数"], ["c", "和最大的一段"]],
  presets: [
    { label: "示例 1", args: { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] }, note: "nums = [-2,1,-3,4,-1,2,1,-5,4]", expect: 6 },
    { label: "全是负数", args: { nums: [-3, -1, -2] }, note: "nums = [-3,-1,-2]", expect: -1 },
  ],
  build(a, snap) {
    const n = a.nums.slice();
    const dp = new Array(n.length).fill(null);
    dp[0] = n[0];
    let cur = n[0], best = n[0], s = 0, bs = 0, be = 0;
    const view = (i, final, opts = {}) => [
      {
        t: "array",
        label: "nums",
        items: n.map((v, j) => ({
          v,
          cls: final ? (j >= bs && j <= be ? "c" : "") : j === i ? "a" : j >= s && j <= i ? "e" : "",
        })),
        ptrs: final ? {} : { i: i >= 0 ? i : null },
      },
      {
        t: "array",
        label: "cur[i]（以位置 i 结尾的最大子数组和）",
        items: dp.map((v, j) => ({
          v,
          cls: final ? (j >= bs && j <= be ? "c" : "") : j === i ? "a" : j >= s && j < i ? "e" : "",
        })),
        ptrs: {},
        feeds: (opts.feeds || []).slice(),
      },
    ];
    snap(
      "开始",
      `从第一个数开始，只能选 nums[0] = <b>${n[0]}</b>，所以 cur = ${cur}，best = ${best}。`,
      view(0, false),
      { at: "init", facts: [["cur", cur], ["best", best], ["当前段", "[0, 0]"]] },
    );
    for (let i = 1; i < n.length; i++) {
      const x = n[i], prevCur = cur, prevBest = best, ext = prevCur + x;
      const takePrev = ext >= x;
      cur = takePrev ? ext : x;
      if (!takePrev) s = i;
      dp[i] = cur;
      if (cur > best) {
        best = cur; bs = s; be = i;
      }
      snap(
        takePrev ? "接上" : "重新开始",
        takePrev
          ? `前面这段的和是 ${prevCur}，接上 ${x} 得到 ${ext}（≥ ${x}），<b>接上</b>！cur = ${cur}。`
          : `前面这段的和是 ${prevCur}，是负担。接上只有 ${ext} &lt; ${x}，不如从 ${x} <b>重新开始</b>！`,
        view(i, false, {
          feeds: [
            takePrev
              ? { from: i - 1, to: i, win: true, label: `${x >= 0 ? "+" : ""}${x}` }
              : { from: i - 1, to: i, win: false, label: `舍弃(${prevCur})` },
          ],
        }),
        {
          at: "step",
          ...(takePrev ? {} : { kind: "warn" }),
          facts: [
            ["cur", cur, prevCur],
            ["best", best, prevBest],
            ["当前段", `[${s}, ${i}]`],
          ],
        },
      );
    }
    snap(
      "完成",
      `最大子数组和是 <b>${best}</b>，对应 [${n.slice(bs, be + 1).join(", ")}]（下标 ${bs}..${be}）。`,
      view(-1, true),
      { at: "done", kind: "ok", ans: best, facts: [["best", best], ["最优区间", `[${bs}, ${be}]`]] },
    );
  },
  points: [
    { t: "初始值用 nums[0]", body: "不能用 0。数组全是负数时，答案是最大的那个负数，用 0 会出错。" },
    { t: "子数组至少一个数", body: "题目要求子数组非空，所以「重新开始」是从当前的数开始，不是从空开始。" },
    { t: "复杂度", body: "时间 O(n)，空间 O(1)。" },
  ],
};
