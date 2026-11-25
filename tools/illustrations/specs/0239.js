module.exports = {
  id: 239, name: "滑动窗口最大值", title: "滑动窗口最大值图解", level: "困难", topic: "子串",
  h1: "滑动窗口最大值，队列里只留有希望的数",
  lede: "一个数右边如果来了比它更大的数，它就再也不可能成为窗口最大值，可以直接扔掉。这样队列里留下的数从头到尾是递减的，队头永远是当前窗口的最大值。",
  hints: [
    { t: "哪些数可以不用记", body: ["窗口里如果有 <code>nums[i] ≤ nums[j]</code> 且 <code>i &lt; j</code>，那 <code>nums[i]</code> 没用了：它比 <code>nums[j]</code> 小，还比它先离开窗口。", "所以新数进来时，可以把它前面所有不比它大的数都丢掉。"] },
    { t: "单调队列", body: ["用一个双端队列存<strong>下标</strong>，对应的值从队头到队尾递减。", "新数进来：从队尾弹出所有不比它大的，再把它放到队尾。队头就是窗口最大值。"] },
    { t: "队头什么时候过期", body: ["队头的下标如果已经滑出窗口（<code>≤ i − k</code>），就从队头弹出。", "存下标而不是值，就是为了能判断这一点。"] },
  ],
  codes: [{ t: "标准解法：单调队列", kind: "elegant", code: `
class Solution:
    def maxSlidingWindow(self, nums: List[int], k: int) -> List[int]:
        q, res = deque(), []            # q 存下标，对应的值递减 #@init
        for i, x in enumerate(nums):
            while q and nums[q[-1]] <= x:   #@push
                q.pop()                 # 队尾比新数小，没用了 #@push
            q.append(i)                 #@push
            if q[0] <= i - k:           #@expire
                q.popleft()             # 队头滑出窗口 #@expire
            if i >= k - 1:              #@record
                res.append(nums[q[0]])  #@record
        return res                      #@done
` }],
  pytest: `
s = Solution()
assert s.maxSlidingWindow([1,3,-1,-3,5,3,6,7], 3) == [3,3,5,5,6,7]
assert s.maxSlidingWindow([1], 1) == [1]
assert s.maxSlidingWindow([7,2,4], 2) == [7,4]
assert s.maxSlidingWindow([9,8,7,6,5], 2) == [9,8,7,6]
`,
  sig: { fn: "maxSlidingWindow", params: ["int[]", "int"], ret: "int[]" },
  call: (a) => [a.nums, a.k],
  cases: [[[1], 1], [[7, 2, 4], 2], [[1, -1], 1], [[4, 4, 4, 1], 4], [[-10000, 10000, -10000, 3, 3, 2], 3]],
  legend: [["e", "窗口"], ["a", "新进来的数"], ["b", "被淘汰 / 过期出队"], ["c", "队头，窗口最大值"], ["w", "还在队列里"], ["d", "已滑过 / 已记录"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 3, -1, -3, 5, 3, 6, 7], k: 3 }, note: "nums = [1,3,-1,-3,5,3,6,7], k = 3", expect: [3, 3, 5, 5, 6, 7] },
    { label: "一路递减", args: { nums: [9, 8, 7, 6, 5], k: 2 }, note: "nums = [9,8,7,6,5], k = 2", expect: [9, 8, 7, 6] },
  ],
  build(a, snap) {
    const { nums, k } = a, n = nums.length, q = [], res = Array(Math.max(0, n - k + 1)).fill(null);
    const view = (i, opts = {}) => {
      const poppedSet = new Set(opts.popped || []);
      const exp = opts.expired ?? -1;
      const curResIdx = opts.resIdx ?? -1;
      const winStart = Math.max(0, i - k + 1);
      return [
        {
          t: "array",
          label: "nums",
          items: nums.map((v, j) => ({
            v,
            cls: j === opts.recHead ? "c"
              : j === exp || poppedSet.has(j) ? "b"
                : j === i ? "a"
                  : q.length && j === q[0] ? "c"
                    : q.includes(j) ? "w"
                      : i >= 0 && i < n && j <= i && j >= winStart ? "e"
                        : i >= 0 && j < winStart ? "d" : "",
          })),
          ptrs: i >= 0 && i < n ? (i >= k - 1 ? { l: i - k + 1, i } : { i }) : {},
        },
        {
          t: "chips",
          label: "单调队列（左边是队头，写的是 下标:值）",
          items: q.map((j, t) => ({ v: `${j}:${nums[j]}`, cls: t === 0 ? "c" : "w" })),
          empty: "空",
        },
        {
          t: "array",
          label: "结果 res（每个完整窗口的最大值）",
          items: res.map((v, idx) => ({
            v: v === null ? "" : v,
            cls: idx === curResIdx ? "c" : v !== null ? "d" : "",
          })),
          ptrs: curResIdx >= 0 ? { 写入: curResIdx } : {},
        },
      ];
    };
    let prevWinStr = "空", prevHeadVal = "—", prevQLen = 0;
    snap("开始", `窗口大小 k = ${k}。队列存下标，保证对应的值从队头到队尾递减。`, view(-1), {
      at: "init",
      facts: [["窗口", "空"], ["队头最大值", "—"], ["队列长度", 0], ["已记录", `0/${res.length}`]],
    });
    for (let i = 0; i < n; i++) {
      const x = nums[i], poppedIdx = [], poppedVals = [];
      while (q.length && nums[q[q.length - 1]] <= x) {
        const idx = q.pop();
        poppedIdx.push(idx);
        poppedVals.push(nums[idx]);
      }
      q.push(i);
      const winL = Math.max(0, i - k + 1), curWinStr = `[${winL}..${i}]`;
      const curHeadVal = nums[q[0]], curQLen = q.length;
      const recordedCnt = Math.max(0, i - k + 1);
      snap(
        "入队",
        `新数 ${x}（下标 ${i}）进来。` + (poppedVals.length ? `队尾的 ${poppedVals.join("、")} 不比它大，又比它先离开窗口，<b>全部弹出</b>。` : "队尾没有比它小的数。") + `把 ${i}:${x} 放到队尾。`,
        view(i, { popped: poppedIdx }),
        {
          at: "push",
          facts: [
            ["窗口", curWinStr, prevWinStr],
            curHeadVal !== prevHeadVal ? ["队头最大值", curHeadVal, prevHeadVal] : ["队头最大值", curHeadVal],
            curQLen !== prevQLen ? ["队列长度", curQLen, prevQLen] : ["队列长度", curQLen],
            ["已记录", `${recordedCnt}/${res.length}`],
          ],
        },
      );
      prevWinStr = curWinStr;
      prevHeadVal = curHeadVal;
      prevQLen = curQLen;

      if (q[0] <= i - k) {
        const exp = q.shift();
        const newHeadVal = nums[q[0]], newQLen = q.length;
        snap(
          "队头过期",
          `队头 ${nums[exp]}（下标 ${exp}）已经滑出窗口 ${curWinStr}，从队头弹出。`,
          view(i, { expired: exp }),
          {
            at: "expire",
            kind: "warn",
            facts: [
              ["窗口", curWinStr],
              newHeadVal !== prevHeadVal ? ["队头最大值", newHeadVal, prevHeadVal] : ["队头最大值", newHeadVal],
              ["队列长度", newQLen, prevQLen],
              ["已记录", `${recordedCnt}/${res.length}`],
            ],
          },
        );
        prevHeadVal = newHeadVal;
        prevQLen = newQLen;
      }

      if (i >= k - 1) {
        const wIdx = i - k + 1, maxVal = nums[q[0]];
        res[wIdx] = maxVal;
        snap(
          "记录最大值",
          `窗口 [${wIdx}, ${i}] 的最大值是队头 <b>${maxVal}</b>（下标 ${q[0]}），写入 res[${wIdx}]。`,
          view(i, { recHead: q[0], resIdx: wIdx }),
          {
            at: "record",
            kind: "ok",
            facts: [
              ["窗口", curWinStr],
              ["队头最大值", maxVal],
              ["队列长度", q.length],
              ["已记录", `${wIdx + 1}/${res.length}`, `${wIdx}/${res.length}`],
            ],
          },
        );
      }
    }
    snap("完成", `结果是 [${res.join(", ")}]。每个下标最多进队一次、出队一次。`, view(n + k), {
      at: "done",
      kind: "ok",
      ans: res.slice(),
      facts: [["结果", `[${res.join(", ")}]`], ["已记录", `${res.length}/${res.length}`]],
    });
  },
  points: [
    { t: "队列里存下标", body: "只存值的话没法判断队头是不是已经滑出窗口。" },
    { t: "相等的也弹出", body: "条件是 <code>&lt;=</code>：值相等时留下标更靠右的那个，它在窗口里待得更久。" },
    { t: "复杂度", body: "每个元素进出队列各一次，时间 O(n)，空间 O(k)。" },
  ],
};
