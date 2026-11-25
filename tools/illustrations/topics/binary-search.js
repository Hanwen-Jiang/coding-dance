module.exports = {
  slug: "binary-search", name: "二分查找", kind: "algo", order: 1,
  lede: "在有序的范围里，每次看中间一个位置，就能排除一半。写对二分只要想清楚三件事：区间是闭的还是半开的、循环什么时候停、mid 排除之后 lo / hi 怎么动。",
  related: [35, 74, 34, 33, 153, 4],
  sections: [{
    key: "find", t: "找一个数",
    body: [
      "数组有序时，看一眼中间的 <code>nums[mid]</code>：比 target 小，说明 mid 和它左边全都太小，答案只可能在右半边；比 target 大就去左半边。每次排除一半，n 个数最多看 log₂n 次。",
      "这里用<b>闭区间</b> <code>[lo, hi]</code> 表示「还没排除的范围」：一开始是整个数组，<code>lo &gt; hi</code> 时范围空了，说明没有这个数。mid 已经看过，所以更新时写 <code>mid + 1</code> 和 <code>mid - 1</code>，把它排除掉。",
    ],
    points: [
      { t: "循环条件是 lo <= hi", body: "闭区间里 <code>lo == hi</code> 时还剩一个数没看，不能停。" },
      { t: "防止溢出", body: "Java / C++ 里 <code>lo + hi</code> 可能超出 int，写成 <code>lo + (hi - lo) / 2</code>。Python 和 JavaScript 没有这个问题。" },
    ],
    codes: [{ t: "闭区间写法", key: "find", code: `
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        lo, hi = 0, len(nums) - 1           # 闭区间 [lo, hi] 是还没排除的范围 #@init
        while lo <= hi:                     # 区间不空就继续 #@loop
            mid = (lo + hi) // 2            #@mid
            if nums[mid] == target:         #@hit
                return mid                  #@hit
            if nums[mid] < target:          #@right
                lo = mid + 1                # mid 和它左边都太小 #@right
            else:                           #@left
                hi = mid - 1                # mid 和它右边都太大 #@left
        return -1                           #@miss
` }],
    sig: { fn: "search", params: ["int[]", "int"], ret: "int" },
    call: (a) => [a.nums, a.target],
    cases: [[[5], 5], [[5], -5], [[-1, 0, 3, 5, 9, 12], 9], [[-1, 0, 3, 5, 9, 12], 2], [[1, 3], 3]],
    gen: (R) => {
      const nums = R.sorted(R.distinct(R.int(5, 10), 1, 30));
      const target = R.chance(0.7) ? R.pick(nums) : R.int(0, 31);
      return { args: { nums, target }, note: `nums = ${R.fmt(nums)}, target = ${target}` };
    },
    demo: {
      legend: [["a", "mid"], ["e", "还没排除"], ["d", "已经排除"], ["c", "找到了"]],
      presets: [
        { label: "找得到", args: { nums: [-1, 0, 3, 5, 9, 12], target: 9 }, note: "nums = [-1,0,3,5,9,12], target = 9", expect: 4 },
        { label: "找不到", args: { nums: [-1, 0, 3, 5, 9, 12], target: 2 }, note: "nums = [-1,0,3,5,9,12], target = 2", expect: -1 },
      ],
      build(a, snap) {
        const nums = a.nums, t = a.target, n = nums.length;
        let lo = 0, hi = n - 1, mid = null;
        const view = (hit) => [{
          t: "array",
          label: "nums",
          items: nums.map((v, i) => ({ v, cls: i === hit ? "c" : i === mid ? "a" : i >= lo && i <= hi ? "e" : "d" })),
          ptrs: { lo: lo < n ? lo : null, hi: hi >= 0 ? hi : null, ...(mid !== null ? { mid } : {}) },
        }];
        snap("开始", `要找 ${t}。还没排除的范围是整个数组：[lo, hi] = [0, ${n - 1}]。`, view(), {
          at: "init",
          facts: [["目标", t], ["lo", lo], ["hi", hi], ["候选数", n]],
        });
        while (lo <= hi) {
          const oldCnt = hi - lo + 1;
          mid = (lo + hi) >> 1;
          snap("看中间", `lo = ${lo} ≤ hi = ${hi}，范围不空。mid = (${lo} + ${hi}) // 2 = ${mid}，nums[mid] = ${nums[mid]}。`, view(), {
            at: ["loop", "mid"],
            facts: [["目标", t], ["lo", lo], ["hi", hi], ["mid", `${mid} (值 ${nums[mid]})`, "—"], ["候选数", oldCnt]],
          });
          if (nums[mid] === t) {
            snap("找到了", `nums[${mid}] 正好是 ${t}，返回 ${mid}。`, view(mid), {
              at: "hit",
              kind: "ok",
              ans: mid,
              facts: [["目标", t], ["命中下标", mid], ["nums[mid]", nums[mid]]],
            });
            return;
          }
          if (nums[mid] < t) {
            const m = mid, oldLo = lo;
            lo = mid + 1;
            mid = null;
            const newCnt = Math.max(0, hi - lo + 1);
            snap("去右半边", `${nums[m]} &lt; ${t}：mid 和它左边的数都太小，全部排除。lo = mid + 1 = ${lo}。`, view(), {
              at: "right",
              facts: [["目标", t], ["lo", lo, oldLo], ["hi", hi], ["候选数", newCnt, oldCnt]],
            });
          } else {
            const m = mid, oldHi = hi;
            hi = mid - 1;
            mid = null;
            const newCnt = Math.max(0, hi - lo + 1);
            snap("去左半边", `${nums[m]} &gt; ${t}：mid 和它右边的数都太大，全部排除。hi = mid - 1 = ${hi}。`, view(), {
              at: "left",
              facts: [["目标", t], ["lo", lo], ["hi", hi, oldHi], ["候选数", newCnt, oldCnt]],
            });
          }
        }
        snap("没找到", `lo = ${lo} &gt; hi = ${hi}，范围空了，数组里没有 ${t}，返回 -1。`, view(), {
          at: "miss",
          kind: "ok",
          ans: -1,
          facts: [["目标", t], ["lo", lo], ["hi", hi], ["结果", -1]],
        });
      },
    },
  }, {
    key: "bounds", t: "左右边界",
    body: [
      "有重复的数时，常要找<b>第一个</b>等于 target 的位置（左边界），或者最后一个（右边界）。统一的办法是写一个 <code>lower_bound(x)</code>：返回第一个 <code>&gt;= x</code> 的位置，没有就返回数组长度。",
      "这时用<b>左闭右开</b>区间 <code>[lo, hi)</code> 更顺手：<code>nums[mid] &lt; x</code> 时 mid 一定不是答案，<code>lo = mid + 1</code>；否则 mid 可能就是答案，<code>hi = mid</code> 把它留在区间里。循环到 <code>lo == hi</code> 停，这个位置就是答案。",
      "左边界是 <code>lower_bound(target)</code>；右边界是「第一个比 target 大的位置」减一，也就是 <code>lower_bound(target + 1) - 1</code>。下面用它数 target 出现了几次（力扣 LCR 172）。",
    ],
    points: [
      { t: "hi 从 len(nums) 开始", body: "所有数都比 x 小时答案是 <code>len(nums)</code>，所以它也要在候选范围里。" },
      { t: "各语言现成的", body: "Python <code>bisect_left</code> / <code>bisect_right</code>，C++ <code>lower_bound</code> / <code>upper_bound</code>，Java 的 <code>Arrays.binarySearch</code> 有重复时不保证返回哪一个，要自己写。" },
    ],
    codes: [{ t: "lower_bound 写两次", key: "bounds", code: `
class Solution:
    def countTarget(self, scores: List[int], target: int) -> int:
        def lower_bound(x: int) -> int:     # 第一个 >= x 的位置
            lo, hi = 0, len(scores)         # 左闭右开 [lo, hi) #@init
            while lo < hi:                  #@loop
                mid = (lo + hi) // 2        #@mid
                if scores[mid] < x:         #@right
                    lo = mid + 1            # mid 太小，一定不是答案 #@right
                else:                       #@left
                    hi = mid                # mid 可能就是答案，留在区间里 #@left
            return lo                       #@ret
        left = lower_bound(target)          # target 第一次出现的位置 #@first
        right = lower_bound(target + 1)     # 第一个比 target 大的位置 #@second
        return right - left                 #@done
` }, { t: "简洁写法：bisect", key: "bounds_bisect", kind: "elegant", note: "<code>bisect_left</code> 就是上面的 lower_bound，<code>bisect_right(x)</code> 等于 <code>bisect_left(x + 1)</code>（整数时）。", code: `
import bisect

class Solution:
    def countTarget(self, scores: List[int], target: int) -> int:
        return bisect.bisect_right(scores, target) - bisect.bisect_left(scores, target)
` }],
    sig: { fn: "countTarget", params: ["int[]", "int"], ret: "int" },
    call: (a) => [a.nums, a.target],
    cases: [[[2, 2, 3, 4, 4, 4, 5, 6, 6, 8], 4], [[1, 2, 3, 5, 7, 9], 6], [[], 1], [[3, 3, 3], 3], [[1], 0]],
    gen: (R) => {
      const nums = R.sorted(R.arr(R.int(6, 10), 1, 8));
      const target = R.chance(0.8) ? R.pick(nums) : R.int(0, 9);
      return { args: { nums, target }, note: `scores = ${R.fmt(nums)}, target = ${target}` };
    },
    demo: {
      legend: [["a", "mid"], ["e", "还在区间 [lo, hi) 里"], ["d", "已经排除"], ["c", "target 出现的范围"]],
      presets: [
        { label: "示例 1", args: { nums: [2, 2, 3, 4, 4, 4, 5, 6, 6, 8], target: 4 }, note: "scores = [2,2,3,4,4,4,5,6,6,8], target = 4", expect: 3 },
        { label: "没有 target", args: { nums: [1, 2, 3, 5, 7, 9], target: 6 }, note: "scores = [1,2,3,5,7,9], target = 6", expect: 0 },
      ],
      build(a, snap) {
        const nums = a.nums, t = a.target, n = nums.length;
        let lo = 0, hi = n, mid = null, left = null, right = null;
        const view = () => [{
          t: "array",
          label: "scores",
          items: nums.map((v, i) => ({
            v,
            cls: i === mid ? "a" : left !== null && right !== null && i >= left && i < right ? "c" : i >= lo && i < hi ? "e" : "d",
          })),
          ptrs: { lo: lo < n ? lo : null, hi: hi < n ? hi : null, ...(mid !== null ? { mid } : {}) },
        }];
        const lowerBound = (x, name) => {
          lo = 0; hi = n; mid = null;
          snap(`${name}：开始`, `找第一个 &gt;= ${x} 的位置。区间 [lo, hi) = [0, ${n})${n ? "" : "，是空的"}。hi 从 ${n} 开始，因为答案可能是「数组长度」。`, view(), {
            at: "init",
            facts: [["阶段", name], ["条件", `>= ${x}`], ["区间 [lo, hi)", `[${lo}, ${hi})`], ["left", left ?? "—"]],
          });
          while (lo < hi) {
            const oldRange = `[${lo}, ${hi})`;
            mid = (lo + hi) >> 1;
            snap(`${name}：看中间`, `mid = (${lo} + ${hi}) // 2 = ${mid}，scores[mid] = ${nums[mid]}。`, view(), {
              at: ["loop", "mid"],
              facts: [["阶段", name], ["条件", `>= ${x}`], ["区间 [lo, hi)", oldRange], ["mid", `${mid} (值 ${nums[mid]})`, "—"]],
            });
            if (nums[mid] < x) {
              const m = mid;
              lo = mid + 1;
              mid = null;
              snap(`${name}：去右边`, `${nums[m]} &lt; ${x}，mid 不可能是答案。lo = ${lo}。`, view(), {
                at: "right",
                facts: [["阶段", name], ["条件", `>= ${x}`], ["区间 [lo, hi)", `[${lo}, ${hi})`, oldRange], ["mid", "—"]],
              });
            } else {
              const m = mid;
              hi = mid;
              mid = null;
              snap(`${name}：往左收`, `${nums[m]} &gt;= ${x}，mid 可能就是答案，留着。hi = mid = ${hi}。`, view(), {
                at: "left",
                facts: [["阶段", name], ["条件", `>= ${x}`], ["区间 [lo, hi)", `[${lo}, ${hi})`, oldRange], ["mid", "—"]],
              });
            }
          }
          return lo;
        };
        left = null;
        const L = lowerBound(t, "左边界");
        left = L;
        snap("左边界", `lo == hi = ${L}，区间空了。第一个 &gt;= ${t} 的位置是 ${L}${L < n ? `（scores[${L}] = ${nums[L]}）` : "（所有数都比它小）"}。`, view(), {
          at: ["ret", "first"],
          facts: [["left", L, "—"], ["right", "—"], ["条件", `>= ${t}`]],
        });
        const Rb = lowerBound(t + 1, "右边界");
        snap("右边界", `第一个 &gt;= ${t + 1}（也就是比 ${t} 大）的位置是 ${Rb}。`, view(), {
          at: ["ret", "second"],
          facts: [["left", L], ["right", Rb, "—"], ["条件", `>= ${t + 1}`]],
        });
        right = Rb; lo = n; hi = n;
        snap("完成", `${t} 出现在 [${L}, ${Rb}) 这一段，一共 ${Rb} - ${L} = ${Rb - L} 次。`, view(), {
          at: "done",
          kind: "ok",
          ans: Rb - L,
          facts: [["left", L], ["right", Rb], ["出现次数", Rb - L]],
        });
      },
    },
  }, {
    key: "answer", t: "二分答案",
    body: [
      "有些题的数组并不有序，但<b>答案</b>有单调性：速度越快，吃完香蕉用的时间越少。「速度 k 能不能在 h 小时内吃完」随 k 增大，先是「不能」，到某个值之后一直是「能」。要找的就是第一个「能」。",
      "于是在答案的范围 <code>[1, max(piles)]</code> 上二分：猜一个 mid，用 O(n) 算一下行不行。行就说明答案是 mid 或更小（<code>hi = mid</code>），不行就要更快（<code>lo = mid + 1</code>）。这和上一节的 lower_bound 是同一个模板。",
    ],
    points: [
      { t: "先确定答案的范围", body: "下界取最小可能的答案，上界取一定可行的答案。这里速度 <code>max(piles)</code> 时每堆一小时，一定吃得完。" },
      { t: "向上取整", body: "<code>(p + k - 1) // k</code> 就是 ⌈p / k⌉，不用浮点数。" },
      { t: "注意溢出", body: "每堆最多 10⁹ 根、速度为 1 时总时间可能超过 int，Java / C++ 里用 long 累加。" },
    ],
    codes: [{ t: "在答案上二分", key: "answer", code: `
class Solution:
    def minEatingSpeed(self, piles: List[int], h: int) -> int:
        def hours(k: int) -> int:           # 速度为 k 时要吃几小时
            return sum((p + k - 1) // k for p in piles)  #@check
        lo, hi = 1, max(piles)              # 答案一定在 [lo, hi] 里 #@init
        while lo < hi:                      #@loop
            mid = (lo + hi) // 2            #@mid
            if hours(mid) <= h:             # 吃得完：答案是 mid 或更小 #@ok
                hi = mid                    #@ok
            else:                           # 吃不完：要更快 #@slow
                lo = mid + 1                #@slow
        return lo                           #@done
` }],
    sig: { fn: "minEatingSpeed", params: ["int[]", "int"], ret: "int" },
    call: (a) => [a.piles, a.h],
    cases: [[[3, 6, 7, 11], 8], [[30, 11, 23, 4, 20], 5], [[30, 11, 23, 4, 20], 6], [[1000000000], 2], [[312884470], 312884469], [[1000000000, 1000000000], 3]],
    gen: (R) => {
      const piles = R.arr(R.int(3, 6), 1, 15);
      const h = piles.length + R.int(0, 8);
      return { args: { piles, h }, note: `piles = ${R.fmt(piles)}, h = ${h}` };
    },
    demo: {
      legend: [["a", "mid：这次猜的速度"], ["e", "答案还可能在这里"], ["d", "已经排除"], ["c", "答案"]],
      presets: [
        { label: "示例 1", args: { piles: [3, 6, 7, 11], h: 8 }, note: "piles = [3,6,7,11], h = 8", expect: 4 },
        { label: "示例 2", args: { piles: [30, 11, 23, 4, 20], h: 6 }, note: "piles = [30,11,23,4,20], h = 6", expect: 23 },
      ],
      build(a, snap) {
        const P = a.piles, h = a.h, max = Math.max(...P);
        const hours = (k) => P.reduce((s, p) => s + Math.ceil(p / k), 0);
        let lo = 1, hi = max, mid = null, ans = null, prevNeed = null;
        // 速度很大时只画 lo..hi 附近：最多显示 20 个候选速度
        const view = (k) => {
          const from = max <= 20 ? 1 : Math.max(1, Math.min(lo, max - 19)), to = Math.min(max, from + 19), sp = [];
          for (let s = from; s <= to; s++) sp.push(s);
          const idxOf = (val) => (val !== null && val >= from && val <= to ? val - from : null);
          return [
            {
              t: "array",
              label: "候选速度 k",
              items: sp.map((s) => ({ v: s, cls: s === ans ? "c" : s === mid ? "a" : s >= lo && s <= hi ? "e" : "d" })),
              idx: false,
              ptrs: { lo: idxOf(lo), hi: idxOf(hi), ...(mid !== null ? { mid: idxOf(mid) } : {}) },
            },
            {
              t: "array",
              label: k ? `每堆要吃几小时（速度 ${k}）` : "piles",
              items: P.map((p) => (k ? { v: Math.ceil(p / k), cls: "e" } : p)),
              idx: false,
            },
          ];
        };
        snap("开始", `速度最慢是 1，最快取 max(piles) = ${max}（每堆一小时，一定吃得完）。答案在 [${lo}, ${hi}] 里。`, view(), {
          at: "init",
          facts: [["范围 [lo, hi]", `[${lo}, ${hi}]`], ["限制", `${h} 小时`], ["速度 mid", "—"]],
        });
        while (lo < hi) {
          const oldRange = `[${lo}, ${hi}]`;
          mid = (lo + hi) >> 1;
          const need = hours(mid);
          snap("猜一个速度", `mid = (${lo} + ${hi}) // 2 = ${mid}。按这个速度一共要 ${need} 小时，限制是 ${h} 小时。`, view(mid), {
            at: ["loop", "mid", "check"],
            facts: [
              ["范围 [lo, hi]", oldRange],
              ["速度 mid", mid, "—"],
              ["要几小时", `${need} 小时`, prevNeed ?? undefined],
              ["限制", `${h} 小时`],
            ],
          });
          prevNeed = `${need} 小时`;
          if (need <= h) {
            hi = mid;
            mid = null;
            snap("吃得完", `${need} ≤ ${h}，速度 ${hi} 够了。答案是 ${hi} 或更慢：hi = ${hi}。`, view(), {
              at: "ok",
              facts: [["范围 [lo, hi]", `[${lo}, ${hi}]`, oldRange], ["上次耗时", `${need} 小时`], ["限制", `${h} 小时`]],
            });
          } else {
            const tried = mid;
            lo = mid + 1;
            mid = null;
            snap("吃不完", `${need} &gt; ${h}，速度 ${tried} 太慢，比它慢的也不行：lo = ${lo}。`, view(), {
              at: "slow",
              facts: [["范围 [lo, hi]", `[${lo}, ${hi}]`, oldRange], ["上次耗时", `${need} 小时`], ["限制", `${h} 小时`]],
            });
          }
        }
        ans = lo;
        const finalNeed = hours(lo);
        snap("完成", `lo == hi = ${lo}，最小的够用的速度就是 ${lo}。`, view(lo), {
          at: "done",
          kind: "ok",
          ans: lo,
          facts: [["最小速度", lo], ["耗时", `${finalNeed} 小时`], ["限制", `${h} 小时`]],
        });
      },
    },
  }],
};
