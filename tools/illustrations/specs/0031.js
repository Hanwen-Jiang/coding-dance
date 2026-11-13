module.exports = {
  id: 31, name: "下一个排列", title: "下一个排列图解", level: "中等", topic: "技巧",
  h1: "下一个排列，只动最右边能动的那一位",
  lede: "想让排列变大一点点，就要改尽量靠右的位置。从右往左找到第一个比右边小的数，和右边比它大的最小的数交换，再把右边整段变成升序。",
  hints: [
    { t: "右边的降序段已经最大了", body: ["从右往左看，如果一段是降序的，比如 <code>[…, 7, 6, 5, 3, 1]</code>，这一段怎么重排都不会更大。", "所以要找的是第一个打破降序的位置 <code>i</code>：<code>nums[i] &lt; nums[i+1]</code>。"] },
    { t: "第 i 位换成谁", body: ["第 <code>i</code> 位要变大，但只大一点点。从右边的降序段里找比 <code>nums[i]</code> 大的数中最小的那个。", "右段是降序，从右往左找第一个比 <code>nums[i]</code> 大的数 <code>nums[j]</code> 就是它，交换两者。"] },
    { t: "交换后右边变成最小", body: ["交换后右段仍然是降序。把它反转成升序，就是这一段最小的样子。", "如果找不到 <code>i</code>，说明整个数组是降序，已经是最大的排列，直接整体反转。"] },
  ],
  codes: [{ t: "标准解法：两遍扫描 + 反转", code: `
class Solution:
    def nextPermutation(self, nums: List[int]) -> None:
        i = len(nums) - 2
        while i >= 0 and nums[i] >= nums[i + 1]:    # 从右往左找第一个下降
            i -= 1
        if i >= 0:
            j = len(nums) - 1
            while nums[j] <= nums[i]:               # 右边第一个比 nums[i] 大的
                j -= 1
            nums[i], nums[j] = nums[j], nums[i]
        l, r = i + 1, len(nums) - 1                 # 右段反转成升序
        while l < r:
            nums[l], nums[r] = nums[r], nums[l]
            l, r = l + 1, r - 1
` }, { t: "简洁写法：next + 切片反转", kind: "elegant", note: "找不到 i 时 next 返回默认值 -1，切片 nums[0:] 正好是整个数组。", code: `
class Solution:
    def nextPermutation(self, nums: List[int]) -> None:
        i = next((i for i in range(len(nums) - 2, -1, -1) if nums[i] < nums[i + 1]), -1)
        if i >= 0:
            j = next(j for j in range(len(nums) - 1, i, -1) if nums[j] > nums[i])
            nums[i], nums[j] = nums[j], nums[i]
        nums[i + 1:] = nums[i + 1:][::-1]
` }],
  pytest: `
s = Solution()
def f(a):
    s.nextPermutation(a); return a
assert f([1,2,3]) == [1,3,2]
assert f([3,2,1]) == [1,2,3]
assert f([1,1,5]) == [1,5,1]
assert f([1,3,2]) == [2,1,3]
assert f([2,3,1]) == [3,1,2]
assert f([1]) == [1]
assert f([1,5,8,4,7,6,5,3,1]) == [1,5,8,5,1,3,4,6,7]
`,
  legend: [["a", "第 i 位"], ["b", "要换上来的 j"], ["e", "右边的降序段"], ["c", "改好的部分"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [1, 3, 2] },
    { label: "长一点的", args: { nums: [1, 5, 8, 4, 7, 6, 5, 3, 1] }, note: "nums = [1,5,8,4,7,6,5,3,1]", expect: [1, 5, 8, 5, 1, 3, 4, 6, 7] },
    { label: "整体降序", args: { nums: [3, 2, 1] }, note: "nums = [3,2,1]", expect: [1, 2, 3] },
  ],
  build(a, snap) {
    const nums = a.nums.slice(), n = nums.length;
    const view = (cls, ptrs) => [{ t: "array", label: "nums", items: nums.map((v, k) => ({ v, cls: cls(k) })), ptrs: ptrs || {} }];
    snap("开始", `要找比 [${nums.join(",")}] 大的排列里最小的那个。先从右往左找第一个比右边小的数。`, view(() => ""));
    let i = n - 2;
    while (i >= 0 && nums[i] >= nums[i + 1]) {
      snap("找下降", `nums[${i}] = ${nums[i]} ≥ nums[${i + 1}] = ${nums[i + 1]}，还在降序段里，继续往左。`, view((k) => (k === i ? "a" : k > i ? "e" : ""), { i }));
      i--;
    }
    if (i >= 0) {
      snap("找到 i", `nums[${i}] = ${nums[i]} &lt; nums[${i + 1}] = ${nums[i + 1]}。右边 [${nums.slice(i + 1).join(",")}] 是降序，已经最大了，要动的是第 <b>${i}</b> 位。`, view((k) => (k === i ? "a" : k > i ? "e" : ""), { i }));
      let j = n - 1;
      while (nums[j] <= nums[i]) j--;
      snap("找 j", `在右段里从右往左找，第一个比 ${nums[i]} 大的是 nums[${j}] = <b>${nums[j]}</b>，它是右段里比 ${nums[i]} 大的最小的数。`, view((k) => (k === i ? "a" : k === j ? "b" : k > i ? "e" : ""), { i, j }));
      [nums[i], nums[j]] = [nums[j], nums[i]];
      snap("交换", `交换后第 ${i} 位变成 ${nums[i]}，排列变大了。右段 [${nums.slice(i + 1).join(",")}] 仍然是降序。`, view((k) => (k === i ? "c" : k > i ? "e" : ""), { i }));
    } else {
      snap("整体降序", "一直找到最左边都没有下降的位置，说明已经是最大的排列。把整个数组反转，回到最小的排列。", view(() => "e"));
    }
    let l = i + 1, r = n - 1;
    while (l < r) { [nums[l], nums[r]] = [nums[r], nums[l]]; l++; r--; }
    snap("反转右段", `把第 ${i + 1} 位之后反转成升序，让右边尽量小。结果是 <b>[${nums.join(",")}]</b>。`, view((k) => (k > i ? "c" : "")), { kind: "ok", ans: nums.slice() });
  },
  points: [
    { t: "比较要带等号", body: "找 i 用 <code>nums[i] &gt;= nums[i+1]</code> 继续走，找 j 用 <code>nums[j] &lt;= nums[i]</code> 继续走。有重复元素时少了等号会出错。" },
    { t: "反转而不是排序", body: "右段本来就是降序，反转就是升序，O(n)，不用 O(n log n) 排序。" },
    { t: "复杂度", body: "最多扫两遍再反转一次，时间 O(n)，原地修改，空间 O(1)。" },
  ],
};
