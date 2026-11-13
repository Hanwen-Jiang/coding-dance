module.exports = {
  id: 75, name: "颜色分类", title: "颜色分类图解", level: "中等", topic: "技巧",
  h1: "颜色分类，三个指针分出三块",
  lede: "荷兰国旗问题。用三个指针把数组分成四段：左边是 0，接着是 1，中间是还没看的，右边是 2。i 扫描中间段：0 换到左边，2 换到右边，1 留在原地。一遍就排好。",
  hints: [
    { t: "只有三种值", body: ["可以数一遍 0、1、2 各有几个，再按个数写回去。但题目希望一遍扫描、原地完成。"] },
    { t: "维护四个区间", body: ["<code>[0, lo)</code> 全是 0，<code>[lo, i)</code> 全是 1，<code>[i, hi]</code> 还没看，<code>(hi, n)</code> 全是 2。"] },
    { t: "看 nums[i]", body: ["是 0：和 <code>nums[lo]</code> 交换，<code>lo</code>、<code>i</code> 都前进。换过来的一定是 1（或者 i == lo），已经看过。", "是 2：和 <code>nums[hi]</code> 交换，<code>hi</code> 后退，<strong>i 不动</strong>，因为换过来的数还没看过。", "是 1：<code>i</code> 前进。"] },
  ],
  codes: [{ t: "标准解法：三指针（荷兰国旗）", code: `
class Solution:
    def sortColors(self, nums: List[int]) -> None:
        lo, i, hi = 0, 0, len(nums) - 1     # [0,lo) 是 0，[lo,i) 是 1，(hi,end] 是 2
        while i <= hi:
            if nums[i] == 0:
                nums[lo], nums[i] = nums[i], nums[lo]
                lo += 1
                i += 1
            elif nums[i] == 2:
                nums[i], nums[hi] = nums[hi], nums[i]
                hi -= 1                     # 换过来的数还没看过，i 不动
            else:
                i += 1
` }, { t: "简洁写法：先写 2，再覆盖成 1 和 0", kind: "elegant", note: "每个位置先写成 2；读到的是 0 或 1，就把 1 的区域往后扩一格；读到的是 0，再把 0 的区域往后扩一格。后写的覆盖先写的。", code: `
class Solution:
    def sortColors(self, nums: List[int]) -> None:
        p0 = p1 = 0                         # 下一个 0、下一个 1 该写的位置
        for i, x in enumerate(nums):
            nums[i] = 2
            if x < 2:
                nums[p1] = 1
                p1 += 1
            if x == 0:
                nums[p0] = 0
                p0 += 1
` }],
  pytest: `
s = Solution()
def f(a):
    s.sortColors(a); return a
assert f([2,0,2,1,1,0]) == [0,0,1,1,2,2]
assert f([2,0,1]) == [0,1,2]
assert f([0]) == [0]
assert f([1,2,0,0,2,1,1]) == [0,0,1,1,1,2,2]
for _ in range(30):
    a = [random.randint(0, 2) for _ in range(random.randint(1, 15))]
    assert f(a[:]) == sorted(a)
`,
  legend: [["e", "确定是 0"], ["g", "确定是 1"], ["w", "确定是 2"], ["a", "nums[i]"]],
  presets: [
    { label: "示例 1", args: { nums: [2, 0, 2, 1, 1, 0] }, note: "nums = [2,0,2,1,1,0]", expect: [0, 0, 1, 1, 2, 2] },
    { label: "示例 2", args: { nums: [2, 0, 1] }, note: "nums = [2,0,1]", expect: [0, 1, 2] },
  ],
  build(a, snap) {
    const nums = a.nums.slice(); let lo = 0, i = 0, hi = nums.length - 1;
    const view = () => [{ t: "array", label: "nums", items: nums.map((v, k) => ({ v, cls: k < lo ? "e" : k < i ? "g" : k > hi ? "w" : k === i ? "a" : "" })), ptrs: { lo, i, hi } }];
    snap("开始", "一开始所有位置都还没看过。", view());
    while (i <= hi) {
      const x = nums[i];
      if (x === 0) { snap("是 0", `nums[${i}] = 0，和 nums[lo=${lo}] 交换，放进 0 的区域。lo、i 都前进。`, view()); [nums[lo], nums[i]] = [nums[i], nums[lo]]; lo++; i++; }
      else if (x === 2) { snap("是 2", `nums[${i}] = 2，和 nums[hi=${hi}] = ${nums[hi]} 交换，放进 2 的区域。hi 后退，i 不动，换过来的 ${nums[hi]} 还没看过。`, view()); [nums[i], nums[hi]] = [nums[hi], nums[i]]; hi--; }
      else { snap("是 1", `nums[${i}] = 1，留在原地，i 前进。`, view()); i++; }
    }
    snap("完成", `i 超过了 hi，中间没有没看过的数了。结果 [${nums.join(",")}]。`, view(), { kind: "ok", ans: nums.slice() });
  },
  points: [
    { t: "换 2 时 i 不前进", body: "从右边换过来的数可能是 0、1、2 中任意一个，必须再判断一次。" },
    { t: "循环条件是 i <= hi", body: "hi 指向的位置还没看过，要包含在内。" },
    { t: "复杂度", body: "一遍扫描，时间 O(n)，空间 O(1)。" },
  ],
};
