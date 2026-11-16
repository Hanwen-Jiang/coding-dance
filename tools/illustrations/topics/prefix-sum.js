module.exports = {
  slug: "prefix-sum", name: "数组与前缀和", kind: "ds", order: 1,
  lede: "数组按下标直接访问是 O(1)，但要算「一段区间的和」就得一个个加。提前算好前缀和，任意区间的和都能用两个数相减得到；反过来，差分数组能把「给一段区间都加上 x」变成改两个位置。",
  related: [560, 238, 53, 437, 303],
  sections: [{
    key: "range", t: "前缀和：区间求和",
    body: [
      "定义 <code>pre[i]</code> 是前 i 个数的和：<code>pre[0] = 0</code>，<code>pre[i + 1] = pre[i] + nums[i]</code>。多开一格、让 <code>pre[0] = 0</code>，是为了从下标 0 开始的区间也能用同一个公式。",
      "区间 <code>[left, right]</code> 的和 = 前 right + 1 个数的和 − 前 left 个数的和 = <code>pre[right + 1] - pre[left]</code>。预处理 O(n)，之后每次查询 O(1)。",
      "「和为 K 的子数组」（560）就是在找有多少对 <code>pre[j] - pre[i] == k</code>，用哈希表记下见过的前缀和就能一趟数完。",
    ],
    points: [
      { t: "下标错一位", body: "<code>pre</code> 比 <code>nums</code> 长 1，<code>pre[i]</code> 不包含 <code>nums[i]</code>。记住「pre[i] 是前 i 个数」就不会乱。" },
      { t: "二维也一样", body: "二维前缀和 <code>pre[i][j]</code> 是左上角 i×j 矩形的和，矩形区域的和用四个角加加减减（容斥）。" },
    ],
    codes: [{ t: "前缀和数组", key: "range", code: `
class NumArray:
    def __init__(self, nums: List[int]):
        self.pre = [0] * (len(nums) + 1)            # pre[i] 是前 i 个数的和 #@init
        for i, x in enumerate(nums):                #@build
            self.pre[i + 1] = self.pre[i] + x       #@build

    def sumRange(self, left: int, right: int) -> int:
        return self.pre[right + 1] - self.pre[left]     # 两个前缀和相减 #@query
` }, { t: "简洁写法：accumulate", key: "range_acc", kind: "elegant", note: "<code>accumulate</code> 一行算出前缀和，<code>initial=0</code> 补上开头的 0。", code: `
from itertools import accumulate

class NumArray:
    def __init__(self, nums: List[int]):
        self.pre = list(accumulate(nums, initial=0))

    def sumRange(self, left: int, right: int) -> int:
        return self.pre[right + 1] - self.pre[left]
` }],
    sig: { cls: "NumArray", ctor: ["int[]"], methods: { sumRange: [["int", "int"], "int"] } },
    call: (a) => [["NumArray", ...a.queries.map(() => "sumRange")], [[a.nums], ...a.queries]],
    cases: [[["NumArray", "sumRange"], [[[5]], [0, 0]]], [["NumArray", "sumRange", "sumRange", "sumRange"], [[[-2, 0, 3, -5, 2, -1]], [0, 2], [2, 5], [0, 5]]]],
    gen: (R) => {
      const nums = R.arr(R.int(4, 8), -5, 9), queries = [];
      for (let k = R.int(2, 3); k > 0; k--) { const l = R.int(0, nums.length - 1); queries.push([l, R.int(l, nums.length - 1)]); }
      return { args: { nums, queries }, note: `nums = ${R.fmt(nums)}，查询 ${queries.map((q) => R.fmt(q)).join(" ")}` };
    },
    demo: {
      legend: [["a", "正在算 / 正在用"], ["e", "这次查询的区间"], ["c", "已经算好"]],
      presets: [{ label: "示例", args: { nums: [-2, 0, 3, -5, 2, -1], queries: [[0, 2], [2, 5], [0, 5]] }, note: "nums = [-2,0,3,-5,2,-1]，查询 [0,2] [2,5] [0,5]", expect: [null, 1, -1, -3] }],
      build(a, snap) {
        const nums = a.nums, n = nums.length, pre = new Array(n + 1).fill(null), out = [null];
        pre[0] = 0;
        let cur = -1, ql = -1, qr = -2, use = [];
        const view = () => [
          { t: "array", label: "nums", items: nums.map((v, i) => ({ v, cls: i === cur ? "a" : i >= ql && i <= qr ? "e" : "" })) },
          { t: "array", label: "pre（pre[i] 是前 i 个数的和）", items: pre.map((v, i) => ({ v: v === null ? "" : v, cls: use.includes(i) ? "a" : v === null ? "" : "c" })) },
          { t: "chips", label: "查询结果", items: out.slice(1), empty: "还没有查询" },
        ];
        snap("开始", `pre 比 nums 多一格，pre[0] = 0：前 0 个数的和是 0。`, view(), { at: "init" });
        for (let i = 0; i < n; i++) {
          pre[i + 1] = pre[i] + nums[i]; cur = i; use = [i, i + 1];
          snap("算前缀和", `pre[${i + 1}] = pre[${i}] + nums[${i}] = ${pre[i]} + ${nums[i]} = ${pre[i + 1]}。`, view(), { at: "build" });
        }
        cur = -1; use = [];
        for (const [l, r] of a.queries) {
          ql = l; qr = r; use = [r + 1, l];
          const s = pre[r + 1] - pre[l];
          out.push(s);
          snap("查询", `sumRange(${l}, ${r}) = pre[${r + 1}] - pre[${l}] = ${pre[r + 1]} - ${pre[l]} = ${s}。不用再一个个加。`, view(), { at: "query" });
        }
        ql = -1; qr = -2; use = [];
        snap("完成", `每次查询只做一次减法。`, view(), { at: [], kind: "ok", ans: out });
      },
    },
  }, {
    key: "diff", t: "差分：区间加",
    body: [
      "前缀和的反面是<b>差分</b>：<code>diff[i] = ans[i] - ans[i - 1]</code>。给区间 <code>[l, r]</code> 每个数都加上 x，在差分数组上只要改两处：<code>diff[l] += x</code>（从 l 开始多了 x），<code>diff[r + 1] -= x</code>（过了 r 又少了 x）。",
      "所有修改做完以后，对差分数组求一遍前缀和，就还原出每个位置的值。m 次区间修改加最后一遍求和，一共 O(n + m)，而直接改是 O(n·m)。",
    ],
    points: [
      { t: "多开一格", body: "<code>diff[r + 1]</code> 在 <code>r</code> 是最后一个位置时会越界，开 <code>n + 1</code> 格就不用判断。" },
      { t: "题目下标从 1 开始", body: "航班编号是 1 到 n，换成数组下标要减 1：区间是 <code>[first - 1, last - 1]</code>，所以减的位置是 <code>last</code>。" },
    ],
    codes: [{ t: "差分数组", key: "diff", code: `
class Solution:
    def corpFlightBookings(self, bookings: List[List[int]], n: int) -> List[int]:
        diff = [0] * (n + 1)                    # diff[i] = ans[i] - ans[i-1] #@init
        for first, last, seats in bookings:     #@add
            diff[first - 1] += seats            # 从 first 开始多了 seats #@add
            diff[last] -= seats                 # 过了 last 又少了 seats #@add
        ans = [0] * n
        cur = 0
        for i in range(n):                      #@sum
            cur += diff[i]                      # 前缀和还原出每个位置的值 #@sum
            ans[i] = cur                        #@sum
        return ans                              #@done
` }],
    sig: { fn: "corpFlightBookings", params: ["int[][]", "int"], ret: "int[]" },
    call: (a) => [a.bookings, a.n],
    cases: [[[[1, 2, 10], [2, 3, 20], [2, 5, 25]], 5], [[[1, 2, 10], [2, 2, 15]], 2], [[[1, 1, 5]], 1]],
    gen: (R) => {
      const n = R.int(3, 7), bookings = [];
      for (let k = R.int(1, 4); k > 0; k--) { const f = R.int(1, n); bookings.push([f, R.int(f, n), R.int(1, 30)]); }
      return { args: { bookings, n }, note: `bookings = ${R.fmt(bookings)}, n = ${n}` };
    },
    demo: {
      legend: [["a", "这一步改的位置"], ["e", "这次预订覆盖的航班"], ["c", "已经还原"]],
      presets: [{ label: "示例 1", args: { bookings: [[1, 2, 10], [2, 3, 20], [2, 5, 25]], n: 5 }, note: "bookings = [[1,2,10],[2,3,20],[2,5,25]], n = 5", expect: [10, 55, 45, 25, 25] }],
      build(a, snap) {
        const n = a.n, diff = new Array(n + 1).fill(0), ans = new Array(n).fill(null);
        let hot = [], lo = -1, hi = -2, cur = 0, at = -1;
        const view = () => [
          { t: "array", label: "diff", items: diff.map((v, i) => ({ v, cls: hot.includes(i) ? "a" : i >= lo && i <= hi ? "e" : "" })) },
          { t: "array", label: "ans（航班 1 到 n）", items: ans.map((v, i) => ({ v: v === null ? "" : v, cls: i === at ? "a" : v === null ? "" : "c" })) },
        ];
        snap("开始", `差分数组 diff 开 n + 1 = ${n + 1} 格，全是 0。`, view(), { at: "init" });
        for (const [f, l, s] of a.bookings) {
          diff[f - 1] += s; diff[l] -= s; hot = [f - 1, l]; lo = f - 1; hi = l - 1;
          snap("区间加", `航班 ${f} 到 ${l} 各加 ${s} 个座位：diff[${f - 1}] += ${s}，diff[${l}] -= ${s}。只改两格。`, view(), { at: "add" });
        }
        hot = []; lo = -1; hi = -2;
        for (let i = 0; i < n; i++) {
          cur += diff[i]; ans[i] = cur; at = i; hot = [i];
          snap("求前缀和", `cur += diff[${i}]，得到 ${cur}：航班 ${i + 1} 一共预订了 ${cur} 个座位。`, view(), { at: "sum", facts: [["cur", cur]] });
        }
        at = -1; hot = [];
        snap("完成", `答案是 [${ans.join(", ")}]。`, view(), { at: "done", kind: "ok", ans: ans.slice() });
      },
    },
  }],
};
