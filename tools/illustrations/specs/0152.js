module.exports = {
  id: 152, name: "乘积最大子数组", title: "乘积最大子数组图解", level: "中等", topic: "动态规划",
  h1: "乘积最大子数组，最小值也要记着",
  lede: "和最大子数组和不同，乘一个负数会让最大的变成最小的、最小的变成最大的。所以每个位置要同时记住「以它结尾的最大积」和「最小积」，碰到负数时两者互换。",
  hints: [
    { t: "只记最大值为什么不够", body: ["<code>[-2, 3, -4]</code>：走到 3 时以它结尾的最大积是 3，但 -2×3 = -6 这个最小积，乘上 -4 后变成 24，才是答案。"] },
    { t: "同时维护最大和最小", body: ["<code>hi</code>、<code>lo</code>：以当前位置结尾的子数组的最大积、最小积。", "新的 <code>hi</code> 是 <code>x</code>、<code>hi·x</code>、<code>lo·x</code> 三者里最大的，新的 <code>lo</code> 是三者里最小的。"] },
    { t: "为什么要和 x 自己比", body: ["从 <code>x</code> 自己重新开始也是一种选择，比如前面是 0 的时候。"] },
  ],
  codes: [{ t: "标准解法：维护最大积和最小积", code: `
class Solution:
    def maxProduct(self, nums: List[int]) -> int:
        hi = lo = best = nums[0]            # 以当前位置结尾的最大积、最小积 #@init
        for x in nums[1:]:
            if x < 0:                       #@swap
                hi, lo = lo, hi             # 乘负数，大小互换 #@swap
            hi = max(x, hi * x)             #@update
            lo = min(x, lo * x)             #@update
            best = max(best, hi)            #@update
        return best                         #@done
` }, { t: "简洁写法：三个候选取最值", kind: "elegant", note: "不判断正负，直接从三个候选里取最大和最小。", code: `
class Solution:
    def maxProduct(self, nums: List[int]) -> int:
        hi = lo = best = nums[0]
        for x in nums[1:]:
            cands = (x, hi * x, lo * x)
            hi, lo = max(cands), min(cands)
            best = max(best, hi)
        return best
` }],
  pytest: `
s = Solution()
assert s.maxProduct([2,3,-2,4]) == 6
assert s.maxProduct([-2,0,-1]) == 0
assert s.maxProduct([-2,3,-4]) == 24
assert s.maxProduct([-2]) == -2
assert s.maxProduct([0,2]) == 2
assert s.maxProduct([-1,-2,-3,0]) == 6
`,
  sig: { fn: "maxProduct", params: ["int[]"], ret: "int" },
  call: (a) => [a.nums],
  cases: [[[-2]], [[0, 2]], [[-1, -2, -3, 0]], [[0, -3, 0]]],
  legend: [["a", "当前的数"], ["c", "最大积对应的子数组"], ["b", "最小积对应的子数组"]],
  presets: [
    { label: "示例 1", args: { nums: [2, 3, -2, 4] }, note: "nums = [2,3,-2,4]", expect: 6 },
    { label: "负负得正", args: { nums: [-2, 3, -4] }, note: "nums = [-2,3,-4]", expect: 24 },
    { label: "有 0", args: { nums: [-2, 0, -1] }, note: "nums = [-2,0,-1]", expect: 0 },
  ],
  build(a, snap) {
    const nums = a.nums, n = nums.length;
    const H = [nums[0]], Lo = [nums[0]]; let best = nums[0];
    const view = (i) => [
      { t: "array", label: "nums", items: nums.map((v, k) => ({ v, cls: k === i ? "a" : "" })), ptrs: { i } },
      { t: "array", label: "hi：以 i 结尾的最大积", items: nums.map((_, k) => ({ v: k < H.length ? H[k] : "", cls: k === i ? "c" : "" })), ptrs: {} },
      { t: "array", label: "lo：以 i 结尾的最小积", items: nums.map((_, k) => ({ v: k < Lo.length ? Lo[k] : "", cls: k === i ? "b" : "" })), ptrs: {} },
    ];
    snap("开始", `第 0 个数 ${nums[0]}：以它结尾的子数组只有它自己，hi = lo = ${nums[0]}。`, view(0), { at: "init", facts: [["最大积", best]] });
    for (let i = 1; i < n; i++) {
      const x = nums[i], h = H[i - 1], l = Lo[i - 1], c = [x, h * x, l * x];
      const nh = Math.max(...c), nl = Math.min(...c);
      H.push(nh); Lo.push(nl); best = Math.max(best, nh);
      snap(`看 ${x}`, `三个候选：${x} 自己、hi×${x} = ${h * x}、lo×${x} = ${l * x}。` + (x < 0 ? "乘的是负数，原来的最小积变成了最大的候选，所以代码里先把 hi、lo 互换。" : "") + `新的 hi = <b>${nh}</b>，lo = ${nl}。`, view(i), { at: x < 0 ? ["swap", "update"] : "update", facts: [["最大积", best]] });
    }
    snap("完成", `所有 hi 里最大的是 <b>${best}</b>。`, view(-1), { at: "done", kind: "ok", ans: best, facts: [["最大积", best]] });
  },
  points: [
    { t: "交换要在计算之前", body: "标准写法里先根据 x 的正负交换 hi、lo，再用交换后的值算。或者像简洁写法那样一次算出三个候选。" },
    { t: "答案初始为 nums[0]", body: "数组可能只有一个负数，答案就是它，不能初始化成 0。" },
    { t: "复杂度", body: "一遍扫描，时间 O(n)，空间 O(1)。" },
  ],
};
