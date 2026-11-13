module.exports = {
  id: 33, name: "搜索旋转排序数组", title: "搜索旋转排序数组图解", level: "中等", topic: "二分查找",
  h1: "搜索旋转排序数组，先看哪一半是有序的",
  lede: "旋转后的数组从中间切一刀，两半里至少有一半是升序的。在有序的那一半里，很容易判断 target 在不在；在就去那一半，不在就去另一半。",
  hints: [
    { t: "切一刀，至少一半有序", body: ["取中点 <code>mid</code>。断点要么在左半，要么在右半，没有断点的那一半就是升序的。", "<code>nums[lo] &lt;= nums[mid]</code> 说明左半有序，否则右半有序。"] },
    { t: "只在有序的那一半里判断", body: ["左半有序时，如果 <code>nums[lo] &lt;= target &lt; nums[mid]</code>，target 只可能在左半；否则去右半。", "右半有序时同理，看 <code>nums[mid] &lt; target &lt;= nums[hi]</code>。"] },
    { t: "边界", body: ["用闭区间 <code>lo &lt;= hi</code>。", "判断左半有序要用 <code>&lt;=</code>：<code>lo == mid</code> 时左半只有一个数，也算有序。"] },
  ],
  codes: [{ t: "标准解法：二分，看哪一半有序", code: `
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] == target:
                return mid
            if nums[lo] <= nums[mid]:               # 左半有序
                if nums[lo] <= target < nums[mid]:
                    hi = mid - 1
                else:
                    lo = mid + 1
            else:                                   # 右半有序
                if nums[mid] < target <= nums[hi]:
                    lo = mid + 1
                else:
                    hi = mid - 1
        return -1
` }, { t: "简洁写法：先判断在不在同一段", kind: "elegant", note: "数组分成两段升序：前一段都 ≥ nums[0]，后一段都 &lt; nums[0]。target 和 nums[mid] 在同一段就按普通二分走，不在同一段就往 target 那段走。", code: `
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] == target:
                return mid
            if (nums[mid] < nums[0]) == (target < nums[0]):    # 同一段
                if nums[mid] < target:
                    lo = mid + 1
                else:
                    hi = mid - 1
            elif target >= nums[0]:                         # target 在前一段
                hi = mid - 1
            else:
                lo = mid + 1
        return -1
` }],
  pytest: `
s = Solution()
assert s.search([4,5,6,7,0,1,2], 0) == 4
assert s.search([4,5,6,7,0,1,2], 3) == -1
assert s.search([1], 0) == -1
assert s.search([1], 1) == 0
assert s.search([3,1], 1) == 1
assert s.search([5,1,3], 5) == 0
base = list(range(1, 8))
for r in range(7):
    a = base[r:] + base[:r]
    for t in range(0, 9):
        assert s.search(a, t) == (a.index(t) if t in a else -1)
`,
  legend: [["e", "还在搜索范围里"], ["a", "mid"], ["k", "有序的那一半"], ["d", "已排除"], ["c", "找到"]],
  presets: [
    { label: "示例 1", args: { nums: [4, 5, 6, 7, 0, 1, 2], target: 0 }, note: "nums = [4,5,6,7,0,1,2], target = 0", expect: 4 },
    { label: "找不到", args: { nums: [4, 5, 6, 7, 0, 1, 2], target: 3 }, note: "nums = [4,5,6,7,0,1,2], target = 3", expect: -1 },
    { label: "在左段", args: { nums: [6, 7, 8, 9, 1, 2, 3, 4, 5], target: 8 }, note: "nums = [6,7,8,9,1,2,3,4,5], target = 8", expect: 2 },
  ],
  build(a, snap) {
    const { nums, target } = a;
    let lo = 0, hi = nums.length - 1;
    const view = (mid, sorted, hit) => [{ t: "array", label: "nums", items: nums.map((v, k) => ({ v, cls: k === hit ? "c" : k === mid ? "a" : k < lo || k > hi ? "d" : sorted && k >= sorted[0] && k <= sorted[1] ? "k" : "e" })), ptrs: { lo, mid, hi } }];
    const facts = () => ({ facts: [["target", target], ["lo", lo], ["hi", hi]] });
    snap("开始", `在 [${nums.join(",")}] 里找 <b>${target}</b>。搜索范围是整个数组。`, view(-1), facts());
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nums[mid] === target) { snap("找到", `nums[${mid}] = ${nums[mid]}，正好是 target，返回 <b>${mid}</b>。`, view(-2, null, mid), { kind: "ok", ans: mid, ...facts() }); return; }
      if (nums[lo] <= nums[mid]) {
        const inL = nums[lo] <= target && target < nums[mid];
        snap("左半有序", `nums[lo] = ${nums[lo]} ≤ nums[mid] = ${nums[mid]}，左半 [${lo}..${mid}] 是升序的。${target} ${inL ? "在" : "不在"} [${nums[lo]}, ${nums[mid]}) 里，${inL ? "去左半" : "去右半"}。`, view(mid, [lo, mid]), facts());
        if (inL) hi = mid - 1; else lo = mid + 1;
      } else {
        const inR = nums[mid] < target && target <= nums[hi];
        snap("右半有序", `nums[lo] = ${nums[lo]} &gt; nums[mid] = ${nums[mid]}，断点在左半，右半 [${mid}..${hi}] 是升序的。${target} ${inR ? "在" : "不在"} (${nums[mid]}, ${nums[hi]}] 里，${inR ? "去右半" : "去左半"}。`, view(mid, [mid, hi]), facts());
        if (inR) lo = mid + 1; else hi = mid - 1;
      }
    }
    snap("没找到", `lo = ${lo} &gt; hi = ${hi}，范围空了，数组里没有 ${target}，返回 <b>-1</b>。`, view(-1), { kind: "warn", ans: -1, ...facts() });
  },
  points: [
    { t: "左半有序用 <=", body: "<code>nums[lo] &lt;= nums[mid]</code>。只有两个数时 lo 等于 mid，少了等号会判错方向。" },
    { t: "区间开闭要一致", body: "判断 target 是否在有序半边时，靠 mid 那一端是开的（mid 已经比较过），另一端是闭的。" },
    { t: "复杂度", body: "每轮扔掉一半，时间 O(log n)，空间 O(1)。" },
  ],
};
