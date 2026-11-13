module.exports = {
  id: 239, name: "滑动窗口最大值", title: "滑动窗口最大值图解", level: "困难", topic: "子串",
  h1: "滑动窗口最大值，队列里只留有希望的数",
  lede: "一个数右边如果来了比它更大的数，它就再也不可能成为窗口最大值，可以直接扔掉。这样队列里留下的数从头到尾是递减的，队头永远是当前窗口的最大值。",
  hints: [
    { t: "哪些数可以不用记", body: ["窗口里如果有 <code>nums[i] ≤ nums[j]</code> 且 <code>i &lt; j</code>，那 <code>nums[i]</code> 没用了：它比 <code>nums[j]</code> 小，还比它先离开窗口。", "所以新数进来时，可以把它前面所有不比它大的数都丢掉。"] },
    { t: "单调队列", body: ["用一个双端队列存<strong>下标</strong>，对应的值从队头到队尾递减。", "新数进来：从队尾弹出所有不比它大的，再把它放到队尾。队头就是窗口最大值。"] },
    { t: "队头什么时候过期", body: ["队头的下标如果已经滑出窗口（<code>≤ i − k</code>），就从队头弹出。", "存下标而不是值，就是为了能判断这一点。"] },
  ],
  codes: [{ t: "标准解法：单调队列", code: `
class Solution:
    def maxSlidingWindow(self, nums: List[int], k: int) -> List[int]:
        q, res = deque(), []            # q 存下标，对应的值递减
        for i, x in enumerate(nums):
            while q and nums[q[-1]] <= x:
                q.pop()                 # 队尾比新数小，没用了
            q.append(i)
            if q[0] <= i - k:
                q.popleft()             # 队头滑出窗口
            if i >= k - 1:
                res.append(nums[q[0]])
        return res
` }],
  pytest: `
s = Solution()
assert s.maxSlidingWindow([1,3,-1,-3,5,3,6,7], 3) == [3,3,5,5,6,7]
assert s.maxSlidingWindow([1], 1) == [1]
assert s.maxSlidingWindow([7,2,4], 2) == [7,4]
assert s.maxSlidingWindow([9,8,7,6,5], 2) == [9,8,7,6]
`,
  legend: [["e", "窗口"], ["a", "新进来的数"], ["c", "队头，窗口最大值"], ["w", "还在队列里"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 3, -1, -3, 5, 3, 6, 7], k: 3 }, note: "nums = [1,3,-1,-3,5,3,6,7], k = 3", expect: [3, 3, 5, 5, 6, 7] },
    { label: "一路递减", args: { nums: [9, 8, 7, 6, 5], k: 2 }, note: "nums = [9,8,7,6,5], k = 2", expect: [9, 8, 7, 6] },
  ],
  build(a, snap) {
    const { nums, k } = a, q = [], res = [];
    const view = (i) => [
      { t: "array", label: "nums", items: nums.map((v, j) => ({ v, cls: j === i ? "a" : q.length && j === q[0] ? "c" : q.includes(j) ? "w" : j <= i && j > i - k ? "e" : "" })), ptrs: { i: i >= 0 && i < nums.length ? i : null } },
      { t: "chips", label: "单调队列（左边是队头，写的是 下标:值）", items: q.map((j, t) => ({ v: `${j}:${nums[j]}`, cls: t === 0 ? "c" : "w" })) },
      { t: "chips", label: "结果", items: res.slice(), empty: "还没有" },
    ];
    snap("开始", `窗口大小 k = ${k}。队列存下标，保证对应的值从队头到队尾递减。`, view(-1));
    nums.forEach((x, i) => {
      const popped = [];
      while (q.length && nums[q[q.length - 1]] <= x) popped.push(nums[q.pop()]);
      q.push(i);
      let msg = `新数 ${x} 进来。` + (popped.length ? `队尾的 ${popped.join("、")} 不比它大，又比它先离开窗口，<b>全部弹出</b>。` : "队尾没有比它小的数。") + `把 ${x} 放到队尾。`;
      if (q[0] <= i - k) { msg += `队头 ${nums[q[0]]}（下标 ${q[0]}）已经滑出窗口，弹出。`; q.shift(); }
      if (i >= k - 1) { res.push(nums[q[0]]); msg += `窗口 [${i - k + 1}, ${i}] 的最大值是队头 <b>${nums[q[0]]}</b>。`; }
      else msg += "窗口还没满，先不记结果。";
      snap(i >= k - 1 ? "记录最大值" : "填充窗口", msg, view(i));
    });
    snap("完成", `结果是 [${res.join(", ")}]。每个下标最多进队一次、出队一次。`, view(nums.length + k), { kind: "ok", ans: res });
  },
  points: [
    { t: "队列里存下标", body: "只存值的话没法判断队头是不是已经滑出窗口。" },
    { t: "相等的也弹出", body: "条件是 <code>&lt;=</code>：值相等时留下标更靠右的那个，它在窗口里待得更久。" },
    { t: "复杂度", body: "每个元素进出队列各一次，时间 O(n)，空间 O(k)。" },
  ],
};
