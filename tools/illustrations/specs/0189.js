module.exports = {
  id: 189, name: "轮转数组", title: "轮转数组图解", level: "中等", topic: "普通数组",
  h1: "轮转数组，翻转三次",
  lede: "向右轮转 k 步，就是把最后 k 个数搬到最前面。先把整个数组翻转，这 k 个数就到了前面，只是顺序反了。再把前 k 个和后面的各自翻转回来，就得到答案，而且不需要额外的数组。",
  hints: [
    { t: "看结果长什么样", body: ["<code>[1,2,3,4,5,6,7]</code> 右移 3 步变成 <code>[5,6,7,1,2,3,4]</code>。", "也就是后 k 个数整体挪到了前面，两段内部的顺序都没变。"] },
    { t: "k 可能比 n 大", body: ["轮转 n 步等于没动，所以先让 <code>k = k % n</code>。"] },
    { t: "三次翻转", body: ["整体翻转：<code>[7,6,5,4,3,2,1]</code>，后 k 个数到了前面，但两段都是倒着的。", "翻转前 k 个：<code>[5,6,7,…]</code>。再翻转剩下的：<code>[…,1,2,3,4]</code>。"] },
  ],
  codes: [{ t: "标准解法：三次翻转", code: `
class Solution:
    def rotate(self, nums: List[int], k: int) -> None:
        def reverse(i, j):
            while i < j:
                nums[i], nums[j] = nums[j], nums[i] #@swap
                i += 1                  #@swap
                j -= 1                  #@swap

        n = len(nums)                   #@init
        k %= n                          #@init
        reverse(0, n - 1)               # 整体翻转 #@all
        reverse(0, k - 1)               # 翻转前 k 个 #@front
        reverse(k, n - 1)               # 翻转剩下的 #@back
` }, { t: "简洁写法：切片拼接", kind: "elegant", note: "后 k 个挪到前面。k 可能比 n 大，先取模。nums[:] 赋值是原地修改，但切片会用 O(n) 临时空间。", code: `
class Solution:
    def rotate(self, nums: List[int], k: int) -> None:
        k %= len(nums)
        nums[:] = nums[-k:] + nums[:-k] if k else nums
` }],
  pytest: `
for a, k, e in [([1,2,3,4,5,6,7],3,[5,6,7,1,2,3,4]), ([-1,-100,3,99],2,[3,99,-1,-100]), ([1,2],5,[2,1]), ([1],0,[1])]:
    Solution().rotate(a, k); assert a == e
`,
  // 原地修改：判题看调用之后的 nums
  sig: { fn: "rotate", params: ["int[]", "int"], ret: "void", out: 0 },
  call: (a) => [a.nums, a.k],
  cases: [[[1], 0], [[1], 5], [[1, 2], 5], [[-1, -100, 3, 99], 2], [[1, 2, 3], 3]],
  legend: [["e", "正在翻转的范围"], ["a", "正在交换的两个数"], ["c", "已经到位"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3, 4, 5, 6, 7], k: 3 }, note: "nums = [1,2,3,4,5,6,7], k = 3", expect: [5, 6, 7, 1, 2, 3, 4] },
    { label: "k 大于 n", args: { nums: [1, 2, 3, 4, 5], k: 7 }, note: "nums = [1,2,3,4,5], k = 7", expect: [4, 5, 1, 2, 3] },
  ],
  build(a, snap) {
    const n = a.nums.slice(), len = n.length, k = a.k % len; let doneTo = -1;
    const view = (lo, hi, i, j) => [{ t: "array", label: "nums", items: n.map((v, t) => ({ v, cls: t === i || t === j ? "a" : t >= lo && t <= hi ? "e" : t <= doneTo ? "c" : "" })), ptrs: i === undefined ? {} : { i, j } }];
    snap("开始", `n = ${len}，k = ${a.k}` + (a.k !== k ? `，先取余：k % n = <b>${k}</b>。` : "。") + `目标是把最后 ${k} 个数搬到最前面。`, view(-1, -1), { at: "init", facts: [["k % n", k]] });
    const rev = (lo, hi, name, tag) => {
      snap(name, `${name}：翻转下标 ${lo} 到 ${hi} 这一段。`, view(lo, hi), { at: tag, facts: [["k % n", k]] });
      for (let i = lo, j = hi; i < j; i++, j--) {
        [n[i], n[j]] = [n[j], n[i]];
        snap(name, `交换下标 ${i} 和 ${j}，两边往中间靠。`, view(lo, hi, i, j), { at: [tag, "swap"], facts: [["k % n", k]] });
      }
    };
    rev(0, len - 1, "整体翻转", "all");
    if (k > 1) rev(0, k - 1, "翻转前 k 个", "front");
    doneTo = k - 1;
    if (len - k > 1) rev(k, len - 1, "翻转剩下的", "back");
    doneTo = len - 1;
    snap("完成", `三次翻转后得到 [${n.join(", ")}]。`, view(-1, -1), { at: [], kind: "ok", ans: n, facts: [["k % n", k]] });
  },
  points: [
    { t: "先取余", body: "不取余的话，k 大于 n 时 <code>reverse(0, k - 1)</code> 会越界。" },
    { t: "原地修改", body: "写 <code>nums = nums[-k:] + nums[:-k]</code> 只是让局部变量指向新列表，原数组没变。要写成 <code>nums[:] = …</code>。" },
    { t: "复杂度", body: "每个数最多被交换两次，时间 O(n)，空间 O(1)。" },
  ],
};
