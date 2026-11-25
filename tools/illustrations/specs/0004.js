module.exports = {
  id: 4, name: "寻找两个正序数组的中位数", title: "两个正序数组的中位数图解", level: "困难", topic: "二分查找",
  h1: "寻找两个正序数组的中位数，在短的数组上找一刀切的位置",
  lede: "中位数把所有数分成个数相等的左右两半，左半的数都不大于右半的数。在两个数组上各切一刀，让左边的总个数正好是一半。第一刀切在哪，第二刀就被个数定死了，所以只需要在一个数组上二分，找到让「左边都不大于右边」成立的那一刀。",
  hints: [
    { t: "中位数的另一种说法", body: ["把所有数分成左右两半，左半有 <code>(m + n + 1) // 2</code> 个，并且左半的最大值 ≤ 右半的最小值。", "这时中位数就是左半的最大值（总数为奇数），或者左半最大值和右半最小值的平均（总数为偶数）。"] },
    { t: "两刀其实只有一个自由度", body: ["在 A 上切在位置 <code>i</code>（左边 i 个数），在 B 上就必须切在 <code>j = half − i</code>，这样左边一共 half 个。", "所以只需要找 <code>i</code>。"] },
    { t: "怎么判断切对了", body: ["设 A 的切口两边是 <code>l1 | r1</code>，B 的是 <code>l2 | r2</code>。切对的条件是 <code>l1 ≤ r2</code> 且 <code>l2 ≤ r1</code>。", "<code>l1 &gt; r2</code>：A 这边切得太靠右，<code>i</code> 要变小。<code>l2 &gt; r1</code>：切得太靠左，<code>i</code> 要变大。这就可以二分了。"] },
  ],
  codes: [{ t: "标准解法：在较短的数组上二分切口", kind: "elegant", code: `
class Solution:
    def findMedianSortedArrays(self, nums1: List[int], nums2: List[int]) -> float:
        if len(nums1) > len(nums2):           #@init
            nums1, nums2 = nums2, nums1         # 保证在短的数组上二分 #@init
        m, n = len(nums1), len(nums2)           #@init
        half = (m + n + 1) // 2                 # 左半边一共要有多少个数 #@init
        lo, hi = 0, m                           #@init
        while True:                             #@cut
            i = (lo + hi) // 2                  # nums1 左边取 i 个 #@cut
            j = half - i                        # nums2 左边取 j 个 #@cut
            l1 = nums1[i - 1] if i > 0 else float("-inf")  #@cut
            r1 = nums1[i] if i < m else float("inf")       #@cut
            l2 = nums2[j - 1] if j > 0 else float("-inf")  #@cut
            r2 = nums2[j] if j < n else float("inf")       #@cut
            if l1 > r2:                         #@right
                hi = i - 1                      # nums1 切得太靠右 #@right
            elif l2 > r1:                       #@left
                lo = i + 1                      # nums1 切得太靠左 #@left
            else:                               #@found
                if (m + n) % 2:                 #@done
                    return float(max(l1, l2))   #@done
                return (max(l1, l2) + min(r1, r2)) / 2  #@done
` }],
  sig: { fn: "findMedianSortedArrays", params: ["int[]", "int[]"], ret: "double" },
  call: (a) => [a.A, a.B],
  cases: [[[], [1]], [[2], []], [[1, 3], [2]], [[1, 2], [3, 4]], [[0, 0], [0, 0]], [[1, 2, 3, 4, 5], [6]]],
  pytest: `
s = Solution()
assert s.findMedianSortedArrays([1,3], [2]) == 2.0
assert s.findMedianSortedArrays([1,2], [3,4]) == 2.5
assert s.findMedianSortedArrays([], [1]) == 1.0
for _ in range(500):
    a = sorted(random.randint(-9, 9) for _ in range(random.randint(0, 8)))
    b = sorted(random.randint(-9, 9) for _ in range(random.randint(0 if a else 1, 8)))
    c = sorted(a + b); k = len(c)
    assert s.findMedianSortedArrays(a, b) == (c[k // 2] if k % 2 else (c[k // 2 - 1] + c[k // 2]) / 2)
`,
  legend: [["e", "切口左边（左半）"], ["w", "切口右边（右半）"], ["a", "切口两侧正在比较的数"]],
  presets: [
    { label: "总数是奇数", args: { A: [1, 3, 8, 9, 15], B: [7, 11, 18, 19, 21, 25] }, note: "nums1 = [1,3,8,9,15], nums2 = [7,11,18,19,21,25]", expect: 11 },
    { label: "示例 2", args: { A: [1, 2], B: [3, 4] }, note: "nums1 = [1,2], nums2 = [3,4]", expect: 2.5 },
    { label: "总数是偶数", args: { A: [2, 4, 6, 10], B: [1, 3, 5, 7, 8, 9] }, note: "nums1 = [2,4,6,10], nums2 = [1,3,5,7,8,9]", expect: 5.5 },
  ],
  build(a, snap) {
    let A = a.A.slice(), B = a.B.slice();
    const swapped = A.length > B.length;
    if (swapped) [A, B] = [B, A];
    const m = A.length, n = B.length, half = (m + n + 1) >> 1;
    const f = (x) => (x === -Infinity ? "−∞" : x === Infinity ? "+∞" : x);
    const row = (label, arr, cut, hotFn) => ({
      t: "array",
      label,
      items: arr.map((v, t) => ({ v, cls: hotFn && hotFn(t) ? "a" : t < cut ? "e" : "w" })),
      ptrs: cut > 0 ? { "切口 ▸": cut - 1 } : { "◂ 切口": 0 },
    });
    const view = (i, j, hotA, hotB) => [
      row("nums1（较短的数组，在它上面二分）", A, i, hotA),
      row("nums2", B, j, hotB),
    ];
    let lo = 0, hi = m;
    snap(
      "开始",
      `${swapped ? "nums1 比 nums2 长，先交换，保证在较短的数组上二分。" : ""}一共 ${m + n} 个数，左半边要有 <b>${half}</b> 个。在 nums1 的切口范围 [0, ${m}] 上二分 i，nums2 的切口 j = ${half} − i 跟着确定。`,
      [
        { t: "array", label: "nums1（较短的数组，在它上面二分）", items: A.map((v) => ({ v })), ptrs: {} },
        { t: "array", label: "nums2", items: B.map((v) => ({ v })), ptrs: {} },
      ],
      { at: "init", facts: [["half", half], ["区间 [lo, hi]", `[${lo}, ${hi}]`], ["lo", lo], ["hi", hi]] },
    );
    for (;;) {
      const i = (lo + hi) >> 1, j = half - i;
      const l1 = i > 0 ? A[i - 1] : -Infinity, r1 = i < m ? A[i] : Infinity;
      const l2 = j > 0 ? B[j - 1] : -Infinity, r2 = j < n ? B[j] : Infinity;
      const head = `i = (${lo} + ${hi}) // 2 = ${i}，j = ${half} − ${i} = ${j}。切口两侧：nums1 是 ${f(l1)} | ${f(r1)}，nums2 是 ${f(l2)} | ${f(r2)}。`;
      snap(
        "尝试切一刀",
        head + "检查是否满足「左半都不大于右半」（l1 ≤ r2 且 l2 ≤ r1）。",
        view(i, j, (t) => t === i - 1 || t === i, (t) => t === j - 1 || t === j),
        { at: "cut", facts: [["切口 i / j", `${i} / ${j}`], ["nums1 两侧", `${f(l1)} | ${f(r1)}`], ["nums2 两侧", `${f(l2)} | ${f(r2)}`], ["lo", lo], ["hi", hi]] },
      );
      if (l1 > r2) {
        const prevHi = hi, prevRange = `[${lo}, ${hi}]`;
        hi = i - 1;
        snap(
          "切得太靠右，收缩区间",
          `nums1 左边的 ${f(l1)} &gt; nums2 右边的 ${f(r2)}，左半边混进了太大的数。排除 i ≥ ${i} 的切法，hi 左移到 ${hi}。`,
          view(i, j, (t) => t === i - 1, (t) => t === j),
          { at: "right", kind: "warn", facts: [["切口 i / j", `${i} / ${j}`], ["区间 [lo, hi]", `[${lo}, ${hi}]`, prevRange], ["lo", lo], ["hi", hi, prevHi]] },
        );
      } else if (l2 > r1) {
        const prevLo = lo, prevRange = `[${lo}, ${hi}]`;
        lo = i + 1;
        snap(
          "切得太靠左，收缩区间",
          `nums2 左边的 ${f(l2)} &gt; nums1 右边的 ${f(r1)}，nums1 左边拿少了。排除 i ≤ ${i} 的切法，lo 右移到 ${lo}。`,
          view(i, j, (t) => t === i, (t) => t === j - 1),
          { at: "left", kind: "warn", facts: [["切口 i / j", `${i} / ${j}`], ["区间 [lo, hi]", `[${lo}, ${hi}]`, prevRange], ["lo", lo, prevLo], ["hi", hi]] },
        );
      } else {
        const lm = Math.max(l1, l2), rm = Math.min(r1, r2), odd = (m + n) % 2 === 1, ans = odd ? lm : (lm + rm) / 2;
        snap(
          "切对了",
          `${f(l1)} ≤ ${f(r2)} 且 ${f(l2)} ≤ ${f(r1)}，左半边的数都不大于右半边！左半最大是 ${f(lm)}，右半最小是 ${f(rm)}。`,
          view(i, j, (t) => t === i - 1 || t === i, (t) => t === j - 1 || t === j),
          { at: "found", kind: "ok", facts: [["切口 i / j", `${i} / ${j}`], ["左半最大", f(lm)], ["右半最小", f(rm)]] },
        );
        snap(
          "完成",
          odd
            ? `总数是奇数，中位数是左半边的最大值 max(${f(l1)}, ${f(l2)}) = <b>${ans}</b>。`
            : `总数是偶数，中位数是左半边最大值 ${lm} 和右半边最小值 ${rm} 的平均：<b>${ans}</b>。`,
          view(i, j),
          { at: "done", kind: "ok", ans, facts: [["切口 i / j", `${i} / ${j}`], ["中位数", ans]] },
        );
        return;
      }
    }
  },
  points: [
    { t: "在短的数组上二分", body: "这样 <code>j = half − i</code> 一定在 0 到 n 之间，不会越界。复杂度也是 O(log min(m, n))。" },
    { t: "切口在边上时", body: "切口左边或右边没有数时，用负无穷、正无穷代替，比较就不用特判。" },
    { t: "half 的取法", body: "<code>(m + n + 1) // 2</code> 让总数为奇数时左半边多一个，中位数就是左半边的最大值。" },
  ],
};
