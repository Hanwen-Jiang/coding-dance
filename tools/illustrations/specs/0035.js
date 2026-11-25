module.exports = {
  id: 35, name: "搜索插入位置", title: "搜索插入位置图解", level: "简单", topic: "二分查找",
  h1: "搜索插入位置，找第一个不小于 target 的数",
  lede: "不管 target 在不在数组里，答案都是「第一个 ≥ target 的下标」。找到了就是它的位置，没找到就是它该插进去的位置。",
  hints: [
    { t: "两种情况其实是一回事", body: ["target 存在时，返回它的下标；不存在时，返回它插进去后的下标。", "这两个位置都是「第一个 <code>≥ target</code> 的下标」。"] },
    { t: "区间怎么定", body: ["用左闭右开 <code>[lo, hi)</code>，<code>hi</code> 一开始是 <code>n</code>，因为 target 可能比所有数都大，要插在末尾。"] },
    { t: "为什么最后返回 lo", body: ["循环里一直保持：<code>lo</code> 左边都 <code>&lt; target</code>，<code>hi</code> 及右边都 <code>≥ target</code>。", "循环结束时 <code>lo == hi</code>，这个位置就是分界线。"] },
  ],
  codes: [{ t: "标准解法：二分查找", code: `
class Solution:
    def searchInsert(self, nums: List[int], target: int) -> int:
        lo, hi = 0, len(nums)               # 左闭右开 [lo, hi) #@init
        while lo < hi:                      #@small,big
            mid = (lo + hi) // 2            #@small,big
            if nums[mid] < target:          #@small
                lo = mid + 1                # mid 及左边都太小 #@small
            else:                           #@big
                hi = mid                    # mid 可能就是答案 #@big
        return lo                           #@done
` }, { t: "简洁写法：bisect_left", kind: "elegant", code: `
from bisect import bisect_left

class Solution:
    def searchInsert(self, nums: List[int], target: int) -> int:
        return bisect_left(nums, target)
` }],
  sig: { fn: "searchInsert", params: ["int[]", "int"], ret: "int" },
  call: (a) => [a.nums, a.target],
  cases: [[[1], 0], [[1], 1], [[1], 2], [[1, 3, 5, 6], 7], [[1, 3, 5, 6], 0]],
  pytest: `
s = Solution()
assert s.searchInsert([1,3,5,6], 5) == 2
assert s.searchInsert([1,3,5,6], 2) == 1
assert s.searchInsert([1,3,5,6], 7) == 4
assert s.searchInsert([1,3,5,6], 0) == 0
assert s.searchInsert([1], 1) == 0
`,
  legend: [["e", "还没确定的范围"], ["a", "mid"], ["d", "确定 < target"], ["k", "确定 ≥ target"], ["c", "答案"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 3, 5, 6], target: 5 }, note: "nums = [1,3,5,6], target = 5", expect: 2 },
    { label: "示例 2", args: { nums: [1, 3, 5, 6], target: 2 }, note: "nums = [1,3,5,6], target = 2", expect: 1 },
    { label: "插在末尾", args: { nums: [1, 3, 5, 6], target: 7 }, note: "nums = [1,3,5,6], target = 7", expect: 4 },
  ],
  build(a, snap) {
    const nums = a.nums.slice(), target = a.target, n = nums.length;
    let lo = 0, hi = n;
    const view = (mid, ans) => [{
      t: "array",
      label: "nums",
      items: nums.map((v, k) => ({
        v,
        cls: k === ans ? "c" : k === mid ? "a" : k < lo ? "d" : k >= hi ? "k" : "e",
      })),
      ptrs: { lo: lo < n ? lo : null, mid: mid >= 0 ? mid : null, hi: hi < n ? hi : null },
    }];
    snap(
      "开始",
      `找第一个 ≥ ${target} 的下标。区间是左闭右开 [0, ${n})，右端开着，因为可能要插在最后。`,
      view(-1),
      { at: "init", facts: [["target", target], ["区间", `[${lo}, ${hi})`], ["lo", lo], ["hi", hi]] },
    );
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const small = nums[mid] < target;
      snap(
        "计算 mid 并比较",
        `mid = (${lo} + ${hi}) // 2 = ${mid}，nums[${mid}] = ${nums[mid]}，和 target = ${target} 比较。`,
        view(mid),
        { at: small ? "small" : "big", facts: [["target", target], ["mid", `${mid} (值 ${nums[mid]})`], ["lo", lo], ["hi", hi]] },
      );
      if (small) {
        const prevLo = lo, prevRange = `[${lo}, ${hi})`;
        lo = mid + 1;
        snap(
          "排除左半，收缩区间",
          `nums[${mid}] = ${nums[mid]} &lt; ${target}，mid 和它左边都太小，全部排除！lo 右移到 ${lo}。`,
          view(-1),
          { at: "small", facts: [["target", target], ["区间", `[${lo}, ${hi})`, prevRange], ["lo", lo, prevLo], ["hi", hi]] },
        );
      } else {
        const prevHi = hi, prevRange = `[${lo}, ${hi})`;
        hi = mid;
        snap(
          "收缩右边界",
          `nums[${mid}] = ${nums[mid]} ≥ ${target}，mid 右边排除，mid 自己可能是答案，右开边界收到 hi = ${hi}。`,
          view(-1),
          { at: "big", facts: [["target", target], ["区间", `[${lo}, ${hi})`, prevRange], ["lo", lo], ["hi", hi, prevHi]] },
        );
      }
    }
    const msg = lo === n
      ? `所有数都比 ${target} 小，插在末尾，返回 <b>${n}</b>。`
      : nums[lo] === target
        ? `nums[${lo}] 就是 ${target}，返回 <b>${lo}</b>。`
        : `数组里没有 ${target}，它应该插在下标 <b>${lo}</b>，也就是 ${nums[lo]} 前面。`;
    snap(
      "完成",
      `lo = hi = ${lo}。` + msg,
      view(-1, lo),
      { at: "done", kind: "ok", ans: lo, facts: [["target", target], ["插入位置", lo], ["lo", lo], ["hi", hi]] },
    );
  },
  points: [
    { t: "hi 从 n 开始", body: "target 比所有数都大时，答案是 n。hi 从 n-1 开始就会漏掉这种情况。" },
    { t: "不用单独判断相等", body: "相等时走 <code>hi = mid</code> 的分支，最后自然停在第一个等于 target 的位置。" },
    { t: "复杂度", body: "时间 O(log n)，空间 O(1)。" },
  ],
};
