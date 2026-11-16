module.exports = {
  id: 34, name: "在排序数组中查找元素的第一个和最后一个位置", title: "在排序数组中查找元素的第一个和最后一个位置图解", level: "中等", topic: "二分查找",
  h1: "查找第一个和最后一个位置，两次 lower_bound",
  lede: "第一个位置是「第一个 ≥ target 的下标」，最后一个位置是「第一个 ≥ target + 1 的下标」再减一。写好一个 lower_bound，调两次就够了。",
  hints: [
    { t: "拆成两个问题", body: ["开始位置：第一个 <code>≥ target</code> 的下标。", "结束位置：第一个 <code>&gt; target</code> 的下标减一，也就是第一个 <code>≥ target + 1</code> 的下标减一（数组里是整数）。"] },
    { t: "写一个 lower_bound", body: ["<code>lower_bound(x)</code> 返回第一个 <code>≥ x</code> 的下标，都比 x 小时返回 <code>n</code>。", "用左闭右开区间 <code>[lo, hi)</code>：<code>nums[mid] &lt; x</code> 时答案在右边，<code>lo = mid + 1</code>；否则 mid 可能就是答案，<code>hi = mid</code>。"] },
    { t: "别忘了检查是否存在", body: ["<code>start = lower_bound(target)</code>。如果 <code>start == n</code> 或 <code>nums[start] != target</code>，说明数组里没有 target，返回 <code>[-1, -1]</code>。"] },
  ],
  codes: [{ t: "标准解法：手写 lower_bound", code: `
class Solution:
    def searchRange(self, nums: List[int], target: int) -> List[int]:
        def lower_bound(x):                 # 第一个 >= x 的下标
            lo, hi = 0, len(nums)           # 左闭右开 [lo, hi) #@lb
            while lo < hi:
                mid = (lo + hi) // 2        #@mid
                if nums[mid] < x:           #@right
                    lo = mid + 1            #@right
                else:
                    hi = mid                #@left
            return lo                       #@lbret

        start = lower_bound(target)         #@start
        if start == len(nums) or nums[start] != target:     #@none
            return [-1, -1]                 #@none
        return [start, lower_bound(target + 1) - 1]         #@end
` }, { t: "简洁写法：bisect", kind: "elegant", note: "bisect_left 就是 lower_bound，bisect_right 返回第一个 &gt; x 的下标。", code: `
from bisect import bisect_left, bisect_right

class Solution:
    def searchRange(self, nums: List[int], target: int) -> List[int]:
        l = bisect_left(nums, target)
        if l == len(nums) or nums[l] != target:
            return [-1, -1]
        return [l, bisect_right(nums, target) - 1]
` }],
  pytest: `
s = Solution()
assert s.searchRange([5,7,7,8,8,10], 8) == [3,4]
assert s.searchRange([5,7,7,8,8,10], 6) == [-1,-1]
assert s.searchRange([], 0) == [-1,-1]
assert s.searchRange([1], 1) == [0,0]
assert s.searchRange([2,2], 2) == [0,1]
assert s.searchRange([1,2,3], 4) == [-1,-1]
`,
  sig: { fn: "searchRange", params: ["int[]", "int"], ret: "int[]" },
  call: (a) => [a.nums, a.target],
  cases: [[[], 0], [[1], 1], [[2, 2], 2], [[1, 2, 3], 4], [[1, 2, 3], 0]],
  legend: [["e", "还没确定的范围"], ["a", "mid"], ["d", "确定 < x"], ["k", "确定 ≥ x"], ["c", "答案"]],
  presets: [
    { label: "示例 1", args: { nums: [5, 7, 7, 8, 8, 10], target: 8 }, note: "nums = [5,7,7,8,8,10], target = 8", expect: [3, 4] },
    { label: "示例 2", args: { nums: [5, 7, 7, 8, 8, 10], target: 6 }, note: "nums = [5,7,7,8,8,10], target = 6", expect: [-1, -1] },
    { label: "一长串相同", args: { nums: [1, 3, 3, 3, 3, 3, 3, 5], target: 3 }, note: "nums = [1,3,3,3,3,3,3,5], target = 3", expect: [1, 6] },
  ],
  build(a, snap) {
    const { nums, target } = a, n = nums.length;
    let found = [];
    const view = (lo, hi, mid, x) => [{ t: "array", label: `nums（找第一个 ≥ ${x} 的位置）`, items: nums.map((v, k) => ({ v, cls: found.includes(k) ? "c" : k === mid ? "a" : k < lo ? "d" : k >= hi ? "k" : "e" })), ptrs: { lo, mid, hi: hi < n ? hi : null } }];
    // call：这次 lower_bound 是从哪一行调用的（start 或 end）
    const lb = (x, tag, call) => {
      let lo = 0, hi = n;
      snap(tag, `找第一个 ≥ <b>${x}</b> 的下标。区间是左闭右开的 [${lo}, ${hi})。`, view(lo, hi, -1, x), { at: [call, "lb"], facts: [["x", x], ["lo", lo], ["hi", hi]] });
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] < x) {
          snap(tag, `nums[${mid}] = ${nums[mid]} &lt; ${x}，mid 和它左边都不是答案，lo = ${mid + 1}。`, view(lo, hi, mid, x), { at: ["mid", "right"], facts: [["x", x], ["lo", lo], ["hi", hi]] });
          lo = mid + 1;
        } else {
          snap(tag, `nums[${mid}] = ${nums[mid]} ≥ ${x}，mid 可能就是答案，右边界收到 hi = ${mid}。`, view(lo, hi, mid, x), { at: ["mid", "left"], facts: [["x", x], ["lo", lo], ["hi", hi]] });
          hi = mid;
        }
      }
      snap(tag, `lo = hi = ${lo}，第一个 ≥ ${x} 的下标是 <b>${lo}</b>${lo === n ? "（等于 n，说明都比它小）" : ""}。`, view(lo, hi, -1, x), { at: "lbret", facts: [["x", x], ["lo", lo], ["hi", hi]] });
      return lo;
    };
    const start = lb(target, "找开始", "start");
    if (start === n || nums[start] !== target) {
      snap("不存在", `下标 ${start} ${start === n ? "已经出界" : `上的数是 ${nums[start]}，不是 ${target}`}。数组里没有 ${target}，返回 <b>[-1, -1]</b>。`, view(start, start, -1, target), { at: "none", kind: "warn", ans: [-1, -1] });
      return;
    }
    found = [start];
    const end = lb(target + 1, "找结束", "end") - 1;
    found = [];
    for (let k = start; k <= end; k++) found.push(k);
    snap("完成", `开始位置 ${start}，结束位置是第一个 ≥ ${target + 1} 的下标减一，等于 ${end}。答案 <b>[${start}, ${end}]</b>。`, view(end + 1, end + 1, -1, target + 1), { at: "end", kind: "ok", ans: [start, end] });
  },
  points: [
    { t: "左闭右开", body: "hi 初始是 n 而不是 n-1，这样「都比 x 小」时能自然返回 n。" },
    { t: "hi = mid 不减一", body: "nums[mid] ≥ x 时 mid 可能就是答案，不能跳过。" },
    { t: "复杂度", body: "两次二分，时间 O(log n)，空间 O(1)。" },
  ],
};
