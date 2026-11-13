module.exports = {
  id: 153, name: "寻找旋转排序数组中的最小值", title: "寻找旋转排序数组中的最小值图解", level: "中等", topic: "二分查找",
  h1: "旋转数组的最小值，和最右边的数比",
  lede: "旋转后数组分成两段升序：前一段的数都比最后一个数大，后一段的数都不超过最后一个数。最小值是后一段的第一个数。拿 nums[mid] 和 nums[hi] 比较，就知道 mid 在哪一段。",
  hints: [
    { t: "数组长什么样", body: ["比如 <code>[4,5,6,7,0,1,2]</code>：前一段 <code>4..7</code>，后一段 <code>0..2</code>。最小值是后一段的开头。"] },
    { t: "和谁比较", body: ["<code>nums[mid] &gt; nums[hi]</code>：mid 在前一段，最小值在 mid 右边，<code>lo = mid + 1</code>。", "否则 mid 在后一段，mid 可能就是最小值，<code>hi = mid</code>。"] },
    { t: "为什么不和 nums[lo] 比", body: ["数组没有旋转时（整体升序），<code>nums[mid] &gt; nums[lo]</code> 也成立，但最小值在左边，判断就反了。和右端比没有这个问题。"] },
  ],
  codes: [{ t: "标准解法：二分，和右端比较", code: `
class Solution:
    def findMin(self, nums: List[int]) -> int:
        lo, hi = 0, len(nums) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if nums[mid] > nums[hi]:        # mid 在前一段，最小值在右边
                lo = mid + 1
            else:                           # mid 在后一段，可能就是最小值
                hi = mid
        return nums[lo]
` }, { t: "简洁写法：bisect 找第一个 ≤ 末尾的数", kind: "elegant", note: "「nums[i] ≤ nums[-1]」在前一段是 False，在后一段是 True。第一个 True 的位置就是最小值。", code: `
from bisect import bisect_left

class Solution:
    def findMin(self, nums: List[int]) -> int:
        return nums[bisect_left(range(len(nums)), True, key=lambda i: nums[i] <= nums[-1])]
` }],
  pytest: `
s = Solution()
assert s.findMin([3,4,5,1,2]) == 1
assert s.findMin([4,5,6,7,0,1,2]) == 0
assert s.findMin([11,13,15,17]) == 11
assert s.findMin([2,1]) == 1
assert s.findMin([1]) == 1
base = list(range(10))
for r in range(10):
    assert s.findMin(base[r:] + base[:r]) == 0
`,
  legend: [["e", "还在搜索范围里"], ["a", "mid"], ["b", "nums[hi]"], ["d", "已排除"], ["c", "最小值"]],
  presets: [
    { label: "示例 2", args: { nums: [4, 5, 6, 7, 0, 1, 2] }, note: "nums = [4,5,6,7,0,1,2]", expect: 0 },
    { label: "示例 1", args: { nums: [3, 4, 5, 1, 2] }, note: "nums = [3,4,5,1,2]", expect: 1 },
    { label: "没旋转", args: { nums: [11, 13, 15, 17] }, note: "nums = [11,13,15,17]", expect: 11 },
  ],
  build(a, snap) {
    const nums = a.nums; let lo = 0, hi = nums.length - 1;
    const view = (mid, fin) => [{ t: "array", label: "nums", items: nums.map((v, k) => ({ v, cls: fin && k === lo ? "c" : k === mid ? "a" : k === hi && mid >= 0 ? "b" : k < lo || k > hi ? "d" : "e" })), ptrs: { lo, mid: mid >= 0 ? mid : null, hi } }];
    snap("开始", "搜索范围是整个数组。每次拿 nums[mid] 和 nums[hi] 比。", view(-1));
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (nums[mid] > nums[hi]) { snap("在前一段", `nums[mid] = ${nums[mid]} &gt; nums[hi] = ${nums[hi]}，mid 在前一段，最小值在它右边，lo = ${mid + 1}。`, view(mid)); lo = mid + 1; }
      else { snap("在后一段", `nums[mid] = ${nums[mid]} ≤ nums[hi] = ${nums[hi]}，mid 在后一段，最小值在 mid 或它左边，hi = ${mid}。`, view(mid)); hi = mid; }
    }
    snap("完成", `lo = hi = ${lo}，最小值是 <b>${nums[lo]}</b>。`, view(-1, true), { kind: "ok", ans: nums[lo] });
  },
  points: [
    { t: "循环条件 lo < hi", body: "区间缩到一个数时就是答案，不用再比较。" },
    { t: "hi = mid 不减一", body: "mid 在后一段时可能就是最小值，不能跳过。" },
    { t: "复杂度", body: "时间 O(log n)，空间 O(1)。" },
  ],
};
