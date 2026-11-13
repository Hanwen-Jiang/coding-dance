module.exports = {
  id: 238, name: "除了自身以外数组的乘积", title: "除自身以外数组的乘积图解", level: "中等", topic: "普通数组",
  h1: "除自身以外数组的乘积，左边乘一遍，右边乘一遍",
  lede: "不能用除法。每个位置的答案等于它左边所有数的乘积，再乘上它右边所有数的乘积。从左往右扫一遍算出左边的部分，再从右往左扫一遍乘上右边的部分。",
  hints: [
    { t: "把答案拆成两半", body: ["<code>answer[i] = (i 左边所有数的乘积) × (i 右边所有数的乘积)</code>。", "这两部分可以分别算。"] },
    { t: "左边的乘积", body: ["从左往右扫，<code>answer[i]</code> 先存 i 左边所有数的乘积。", "<code>answer[0] = 1</code>（左边没有数），之后 <code>answer[i] = answer[i-1] × nums[i-1]</code>。"] },
    { t: "右边的乘积", body: ["再从右往左扫，用一个变量 <code>right</code> 记录当前位置右边所有数的乘积。", "每到一个位置，<code>answer[i] *= right</code>，然后 <code>right *= nums[i]</code>。这样不需要第二个数组。"] },
  ],
  codes: [{ t: "标准解法：前缀积 × 后缀积", code: `
class Solution:
    def productExceptSelf(self, nums: List[int]) -> List[int]:
        n = len(nums)
        answer = [1] * n
        for i in range(1, n):           # answer[i] = 左边所有数的乘积
            answer[i] = answer[i - 1] * nums[i - 1]
        right = 1                       # 右边所有数的乘积
        for i in range(n - 1, -1, -1):
            answer[i] *= right
            right *= nums[i]
        return answer
` }, { t: "简洁写法：accumulate 算前缀积和后缀积", kind: "elegant", note: "pre[i] 是 i 左边所有数的积，suf[i] 是 i 右边所有数的积，两者相乘。", code: `
from itertools import accumulate
from operator import mul

class Solution:
    def productExceptSelf(self, nums: List[int]) -> List[int]:
        pre = [1, *accumulate(nums[:-1], mul)]
        suf = [*accumulate(nums[:0:-1], mul)][::-1] + [1]
        return [a * b for a, b in zip(pre, suf)]
` }],
  pytest: `
s = Solution()
assert s.productExceptSelf([1,2,3,4]) == [24,12,8,6]
assert s.productExceptSelf([-1,1,0,-3,3]) == [0,0,9,0,0]
assert s.productExceptSelf([2,3]) == [3,2]
`,
  legend: [["a", "当前位置"], ["e", "已有左边的乘积"], ["c", "左右都乘好了"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3, 4] }, note: "nums = [1,2,3,4]", expect: [24, 12, 8, 6] },
    { label: "有 0", args: { nums: [-1, 1, 0, -3, 3] }, note: "nums = [-1,1,0,-3,3]", expect: [0, 0, 9, 0, 0] },
  ],
  build(a, snap) {
    const nums = a.nums, n = nums.length, ans = new Array(n).fill(1), st = new Array(n).fill("");
    const fix = (x) => (Object.is(x, -0) ? 0 : x);
    const view = (i) => [
      { t: "array", label: "nums", items: nums.map((v, j) => ({ v, cls: j === i ? "a" : "" })), ptrs: { i: i >= 0 && i < n ? i : null } },
      { t: "array", label: "answer", items: ans.map((v, j) => ({ v: fix(v), cls: st[j] })), idx: false },
    ];
    st[0] = "e";
    snap("第一遍：从左往右", "answer[0] = 1，因为下标 0 左边没有数。", view(0));
    for (let i = 1; i < n; i++) {
      ans[i] = ans[i - 1] * nums[i - 1]; st[i] = "e";
      snap("第一遍：从左往右", `answer[${i}] = answer[${i - 1}] × nums[${i - 1}] = ${fix(ans[i - 1])} × ${nums[i - 1]} = <b>${fix(ans[i])}</b>，这是下标 ${i} 左边所有数的乘积。`, view(i));
    }
    let right = 1;
    for (let i = n - 1; i >= 0; i--) {
      const before = ans[i]; ans[i] = fix(ans[i] * right); st[i] = "c";
      snap("第二遍：从右往左", `right = ${fix(right)} 是下标 ${i} 右边所有数的乘积。answer[${i}] = ${fix(before)} × ${fix(right)} = <b>${ans[i]}</b>。然后 right 乘上 nums[${i}] = ${nums[i]}。`, view(i), { facts: [["right", fix(right * nums[i])]] });
      right *= nums[i];
    }
    snap("完成", `answer = [${ans.join(", ")}]。`, view(-1), { kind: "ok", ans });
  },
  points: [
    { t: "为什么不用除法", body: "题目禁止。而且数组里有 0 时，总乘积除以 0 会出错。" },
    { t: "先乘再更新 right", body: "<code>answer[i] *= right</code> 要在 <code>right *= nums[i]</code> 之前，否则会把自己也乘进去。" },
    { t: "复杂度", body: "两遍扫描，时间 O(n)。输出数组不算的话，额外空间 O(1)。" },
  ],
};
