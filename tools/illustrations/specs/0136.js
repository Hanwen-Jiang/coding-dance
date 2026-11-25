module.exports = {
  id: 136, name: "只出现一次的数字", title: "只出现一次的数字图解", level: "简单", topic: "技巧",
  h1: "只出现一次的数字，相同的数异或抵消",
  lede: "异或有两个性质：x ^ x = 0，x ^ 0 = x，而且满足交换律和结合律。把所有数异或起来，出现两次的两两抵消成 0，最后剩下的就是只出现一次的那个。",
  hints: [
    { t: "要求 O(1) 空间", body: ["用哈希表或集合计数很容易，但题目要求常数额外空间。"] },
    { t: "什么运算能让两个相同的数消失", body: ["异或：<code>x ^ x = 0</code>，<code>x ^ 0 = x</code>。"] },
    { t: "顺序不重要", body: ["异或满足交换律和结合律，<code>a ^ b ^ a = a ^ a ^ b = b</code>。", "所以从头到尾异或一遍，所有成对的数都会抵消。"] },
  ],
  codes: [{ t: "标准解法：异或", code: `
class Solution:
    def singleNumber(self, nums: List[int]) -> int:
        res = 0                             #@init
        for x in nums:                      #@xor
            res ^= x                        # 成对的数会互相抵消 #@xor
        return res                          #@done
` }, { t: "简洁写法：reduce", kind: "elegant", code: `
from functools import reduce
from operator import xor

class Solution:
    def singleNumber(self, nums: List[int]) -> int:
        return reduce(xor, nums)
` }],
  pytest: `
s = Solution()
assert s.singleNumber([2,2,1]) == 1
assert s.singleNumber([4,1,2,1,2]) == 4
assert s.singleNumber([1]) == 1
assert s.singleNumber([-3,7,-3]) == 7
`,
  sig: { fn: "singleNumber", params: ["int[]"], ret: "int" },
  call: (a) => [a.nums],
  cases: [[[1]], [[-3, 7, -3]], [[-1, 5, 5]]],
  legend: [["a", "当前的数"], ["d", "已经异或过"]],
  presets: [
    { label: "示例 2", args: { nums: [4, 1, 2, 1, 2] }, note: "nums = [4,1,2,1,2]", expect: 4 },
    { label: "示例 1", args: { nums: [2, 2, 1] }, note: "nums = [2,2,1]", expect: 1 },
  ],
  build(a, snap) {
    const nums = a.nums.slice(), w = Math.max(3, ...nums.map((x) => Math.abs(x).toString(2).length));
    const bin = (x) => (x < 0 ? "-" : "") + Math.abs(x).toString(2).padStart(w, "0");
    let res = 0;
    const view = (i, prevRes, fin) => [
      {
        t: "array",
        label: "nums",
        items: nums.map((v, k) => ({ v, cls: k === i ? "a" : k < i ? "d" : "" })),
        ptrs: { i: i >= 0 ? i : null },
      },
      {
        t: "array",
        label: "异或累积 res",
        idx: false,
        items: [{
          v: res,
          ...(prevRes !== undefined && prevRes !== res ? { prev: prevRes } : {}),
          cls: fin ? "c" : "a",
        }],
        ptrs: {},
      },
    ];
    snap("开始", "res 从 0 开始（x ^ 0 = x），依次和每个数做异或。", view(-1), {
      at: "init",
      facts: [["res", res], ["二进制", bin(res)]],
    });
    nums.forEach((x, i) => {
      const old = res;
      res ^= x;
      snap(`^ ${x}`, `${bin(old)} ^ ${bin(x)} = <b>${bin(res)}</b>，即 ${old} ^ ${x} = <b>${res}</b>。`, view(i, old), {
        at: "xor",
        facts: [["当前数 x", x], ["res", res, old], ["二进制", bin(res), bin(old)]],
      });
    });
    snap("完成", `成对的数两两抵消成 0，最后剩下 <b>${res}</b>。`, view(-1, undefined, true), {
      at: "done",
      kind: "ok",
      ans: res,
      facts: [["res", res], ["二进制", bin(res)]],
    });
  },
  points: [
    { t: "初始值是 0", body: "0 是异或的单位元，x ^ 0 = x。" },
    { t: "负数也没问题", body: "Python 的整数异或按补码进行，结果正确。" },
    { t: "复杂度", body: "时间 O(n)，空间 O(1)。" },
  ],
};
