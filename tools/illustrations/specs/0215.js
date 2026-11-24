module.exports = {
  id: 215, name: "数组中的第K个最大元素", title: "数组中的第K个最大元素图解", level: "中等", topic: "堆",
  h1: "第 K 个最大元素，快速选择怎么只排一半",
  lede: "借用快速排序的划分，每一轮把数组分成「比 pivot 小 / 等于 / 比 pivot 大」三段，然后只往答案所在的那一段继续找。",
  hints: [
    { t: "换成下标来想", body: ["第 <code>k</code> 大的元素，就是把数组<strong>升序</strong>排好后下标为 <code>n - k</code> 的那个数。", "我们只关心这一个位置放的是谁，其他位置排没排好都无所谓。"] },
    { t: "借快速排序的一步", body: ["快速排序的划分（partition）做完一趟后，pivot 会落在它<strong>排好序后的最终位置</strong>，左边都比它小，右边都比它大。", "比较这个位置和目标下标 <code>n - k</code>：相等就找到了；目标在左边就只处理左边，在右边就只处理右边。另一半直接扔掉，不用再排。"] },
    { t: "为什么是 O(n)，以及两个坑", body: ["每轮平均扔掉一半，总工作量大约是 <code>n + n/2 + n/4 + … ≈ 2n</code>，所以平均 <code>O(n)</code>。", "坑 1：pivot 固定取第一个元素，遇到有序数组每轮只扔掉一个，退化成 <code>O(n²)</code>。所以 pivot 要<strong>随机选</strong>。", "坑 2：力扣有一个全是相同元素的大用例，普通两段划分也会退化。用<strong>三路划分</strong>把等于 pivot 的数单独放中间，一轮就结束。"] },
  ],
  codes: [{ t: "标准解法：随机 pivot + 三路划分", code: `
import random

class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        target = len(nums) - k          # 第 k 大 = 升序下标 n-k #@init
        lo, hi = 0, len(nums) - 1       #@init
        while True:                     #@pivot
            pivot = nums[random.randint(lo, hi)]  #@pivot
            lt, i, gt = lo, lo, hi      # [lo,lt) 小于  [lt,i) 等于  (gt,hi] 大于 #@pivot
            while i <= gt:              #@less,more,eq
                if nums[i] < pivot:     #@less
                    nums[lt], nums[i] = nums[i], nums[lt]  #@less
                    lt += 1             #@less
                    i += 1              #@less
                elif nums[i] > pivot:   #@more
                    nums[i], nums[gt] = nums[gt], nums[i]  #@more
                    gt -= 1             # 换过来的数还没看过，i 不动 #@more
                else:                   #@eq
                    i += 1              #@eq
            if target < lt:             #@left
                hi = lt - 1             # 答案在小于区 #@left
            elif target > gt:           #@right
                lo = gt + 1             # 答案在大于区 #@right
            else:                       #@found
                return pivot            # 落在等于区，就是 pivot #@found
` }, { t: "简洁写法：列表推导式三路划分", kind: "elegant", note: "思路和标准解法一样，只是每轮新建「大于」「小于」两个列表，直接按第 k 大来分，不用换算下标。代价是额外空间平均 O(n)。", code: `
import random

class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        pivot = random.choice(nums)
        left = [x for x in nums if x > pivot]     # 大于区，排在最前面
        right = [x for x in nums if x < pivot]    # 小于区，排在最后面
        if len(left) >= k:                        # 前 k 大全在大于区里
            return self.findKthLargest(left, k)
        elif len(right) > len(nums) - k:          # 答案在小于区
            return self.findKthLargest(right, k + len(right) - len(nums))
        return pivot                              # 落在等于区
` }, { t: "另一种常考写法：大小为 k 的小顶堆", key: "heap", note: "堆里始终保留目前见过的最大的 k 个数，堆顶是其中最小的，也就是第 k 大。复杂度 O(n log k)，写起来短、不改原数组。", code: `
import heapq

class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        heap = nums[:k]                 #@push
        heapq.heapify(heap)             # 先放前 k 个，建小顶堆 #@push
        for x in nums[k:]:
            if x > heap[0]:             # 比堆顶大，才有资格进前 k #@replace,skip
                heapq.heapreplace(heap, x)  #@replace
        return heap[0]                  #@done
` }],
  sig: { fn: "findKthLargest", params: ["int[]", "int"], ret: "int" },
  call: (a) => [a.nums, a.k],
  cases: [[[1], 1], [[2, 2, 2, 2], 3], [[-1, -1], 2], [[5, 4, 3, 2, 1], 5], [[1, 2, 3, 4, 5], 1]],
  pytest: `
s = Solution()
assert s.findKthLargest([3,2,1,5,6,4], 2) == 5
assert s.findKthLargest([3,2,3,1,2,4,5,5,6], 4) == 4
assert s.findKthLargest([1], 1) == 1
assert s.findKthLargest([2,2,2,2], 3) == 2
for _ in range(30):
    a = [random.randint(-20, 20) for _ in range(random.randint(1, 30))]
    k = random.randint(1, len(a))
    assert s.findKthLargest(a[:], k) == sorted(a)[-k]
`,
  demoTitle: "第 K 大演示",
  method: "快速选择",
  methodNote: "和标准解法一样做三路划分，每轮只往目标下标所在的那一段继续找。",
  legend: [["e", "这一轮的范围"], ["a", "刚处理的数"], ["g", "小于 pivot"], ["k", "等于 pivot"], ["w", "大于 pivot"], ["d", "已经扔掉"], ["c", "答案"]],
  presets: [
    { label: "示例 1", args: { nums: [3, 2, 1, 5, 6, 4], k: 2 }, note: "nums = [3,2,1,5,6,4], k = 2", expect: 5 },
    { label: "示例 2", args: { nums: [3, 2, 3, 1, 2, 4, 5, 5, 6], k: 4 }, note: "nums = [3,2,3,1,2,4,5,5,6], k = 4", expect: 4 },
  ],
  alts: [{
    t: "小顶堆",
    code: "heap",
    note: "堆里始终留着目前见过的最大的 k 个数，堆顶是其中最小的。新来的数比堆顶大才有资格进去，把堆顶换掉，并一步步展示上浮 / 下沉的调整过程。",
    legend: [["a", "正在看 / 刚进堆"], ["d", "已经看过"], ["b", "堆顶：目前的第 k 大"], ["e", "正在上浮 / 下沉比较"], ["c", "答案"]],
    build(a, snap) {
      const nums = a.nums.slice(), n = nums.length, k = a.k;
      const heap = [];
      const nodes = (hl = -1, prevMap = {}) => {
        const N = {};
        heap.forEach((v, i) => {
          N[i] = {
            v,
            ...(prevMap[i] !== undefined ? { prev: prevMap[i] } : {}),
            l: 2 * i + 1 < heap.length ? 2 * i + 1 : null,
            r: 2 * i + 2 < heap.length ? 2 * i + 2 : null,
          };
        });
        return N;
      };
      const view = (j, opts = {}) => {
        const cls = {};
        if (heap.length) cls[0] = opts.fin ? "c" : "b";
        if (opts.hl !== undefined && opts.hl >= 0 && opts.hl < heap.length) cls[opts.hl] = opts.hl === 0 && opts.fin ? "c" : "a";
        if (opts.cmp !== undefined && opts.cmp >= 0 && opts.cmp < heap.length) cls[opts.cmp] = "e";
        return [
          { t: "array", label: "nums", items: nums.map((v, t) => ({ v, cls: t === j ? "a" : t < j ? "d" : "" })), ptrs: {} },
          heap.length
            ? {
                t: "tree",
                label: `小顶堆（最多 ${k} 个，堆顶是其中最小的）`,
                nodes: nodes(opts.hl, opts.prevMap),
                root: 0,
                cls,
                ...(opts.swaps ? { swaps: opts.swaps } : {}),
              }
            : { t: "note", label: "小顶堆", html: "空" },
        ];
      };
      const f = (prevTop) => ({
        facts: [
          ["堆大小", `${heap.length} / ${k}`],
          ["堆顶", heap.length ? heap[0] : "—", prevTop],
        ],
      });
      snap("开始", `堆里只留目前见过的最大的 ${k} 个数。全部看完后，堆顶就是第 ${k} 大。`, view(-1), { at: "push", ...f() });

      nums.forEach((x, j) => {
        if (heap.length < k) {
          const oldTop = heap.length ? heap[0] : "—";
          heap.push(x);
          let cur = heap.length - 1;
          snap("放入堆尾", `堆里还不到 ${k} 个，把 <b>${x}</b> 先放到堆尾（节点 ${cur}）。`, view(j, { hl: cur }), { at: "push", ...f(oldTop) });
          while (cur > 0) {
            const p = (cur - 1) >> 1;
            if (heap[p] <= heap[cur]) break;
            const prevTop = heap[0];
            const vp = heap[p], vc = heap[cur];
            [heap[p], heap[cur]] = [heap[cur], heap[p]];
            snap(
              "上浮交换",
              `${vc} 比父节点 ${vp} 小，不符合小顶堆，两人交换上浮！`,
              view(j, { hl: p, cmp: cur, swaps: [[p, cur]], prevMap: { [p]: vp, [cur]: vc } }),
              { at: "push", ...f(prevTop) },
            );
            cur = p;
          }
        } else if (x > heap[0]) {
          const oldTop = heap[0];
          heap[0] = x;
          snap(
            "替换堆顶",
            `${x} 比堆顶 ${oldTop} 大，有资格进前 ${k}。先用 <b>${x}</b> 替换掉堆顶 ${oldTop}。`,
            view(j, { hl: 0, prevMap: { 0: oldTop } }),
            { at: "replace", ...f(oldTop) },
          );
          let cur = 0;
          for (;;) {
            const l = 2 * cur + 1, r = l + 1;
            let s = cur;
            if (l < heap.length && heap[l] < heap[s]) s = l;
            if (r < heap.length && heap[r] < heap[s]) s = r;
            if (s === cur) break;
            const prevTop = heap[0];
            const vc = heap[cur], vs = heap[s];
            [heap[s], heap[cur]] = [heap[cur], heap[s]];
            snap(
              "下沉交换",
              `堆顶方向需要保持最小：${vc} 比孩子 ${vs} 大，和更小的孩子交换下沉！`,
              view(j, { hl: s, cmp: cur, swaps: [[cur, s]], prevMap: { [cur]: vc, [s]: vs } }),
              { at: "replace", ...f(prevTop) },
            );
            cur = s;
          }
        } else {
          snap("跳过", `${x} 不比堆顶 ${heap[0]} 大，进不了前 ${k}，直接跳过。`, view(j), { at: "skip", ...f() });
        }
      });
      snap("完成", `看完了，堆顶 <b>${heap[0]}</b> 就是第 ${k} 大的数。`, view(n, { fin: true }), { at: "done", kind: "ok", ans: heap[0], ...f() });
    },
  }],
  build(a, snap) {
    const nums = a.nums.slice(), n = nums.length, k = a.k;
    const target = n - k;
    let lo = 0, hi = n - 1, lt = 0, i = 0, gt = n - 1, pv = null, hl = -1, done = -1;
    const cls = (j) => (j === done ? "c" : j < lo || j > hi ? "d" : j === hl ? "a" : pv === null ? "e" : j < lt ? "g" : j < i ? "k" : j > gt ? "w" : "e");
    const view = (opts = {}) => [{
      t: "bars",
      label: `nums（目标是升序后下标 ${target} 的数）`,
      items: nums.map((v, j) => ({
        v,
        ...(opts.prevMap && opts.prevMap[j] !== undefined ? { prev: opts.prevMap[j] } : {}),
        cls: cls(j),
      })),
      ptrs: pv === null ? { lo, hi } : { lt, i: i <= gt ? i : null, gt },
      ...(opts.swaps ? { swaps: opts.swaps } : {}),
    }];
    const f = (prevRange) => ({ facts: [["目标下标", target], ["范围", `[${lo}, ${hi}]`, prevRange], ["pivot", pv === null ? "—" : pv]] });
    snap("开始", `第 ${k} 大，就是升序排好后下标 ${n} − ${k} = <b>${target}</b> 的数。只关心这一个位置放的是谁。`, view(), { at: "init", ...f() });
    for (;;) {
      pv = nums[(lo + hi) >> 1]; lt = lo; i = lo; gt = hi; hl = -1;
      snap("选 pivot", `这一轮的范围是 [${lo}, ${hi}]。演示里取中间位置的 <b>${pv}</b> 当 pivot（代码里是随机选的）。`, view(), { at: "pivot", ...f() });
      while (i <= gt) {
        const x = nums[i];
        if (x < pv) {
          const oldLt = nums[lt], oldI = nums[i];
          const didSwap = lt !== i;
          [nums[lt], nums[i]] = [nums[i], nums[lt]];
          lt++; i++; hl = lt - 1;
          snap(
            "小于 pivot",
            didSwap ? `${x} &lt; ${pv}，和 lt 处的 ${oldLt} 交换，放到左边的小于区。` : `${x} &lt; ${pv}，就在小于区边界，lt 和 i 一起前进。`,
            view({ swaps: didSwap ? [[lt - 1, i - 1]] : [], prevMap: didSwap ? { [lt - 1]: oldLt, [i - 1]: oldI } : {} }),
            { at: "less", ...f() },
          );
        } else if (x > pv) {
          const oldI = nums[i], oldGt = nums[gt];
          const didSwap = i !== gt;
          [nums[i], nums[gt]] = [nums[gt], nums[i]];
          gt--; hl = gt + 1;
          snap(
            "大于 pivot",
            didSwap ? `${x} &gt; ${pv}，和 gt 处的 ${oldGt} 交换到右边的大于区。换过来的 ${nums[i]} 还没看过，i 不动。` : `${x} &gt; ${pv}，就在大于区边界，gt 左移。`,
            view({ swaps: didSwap ? [[i, gt + 1]] : [], prevMap: didSwap ? { [i]: oldI, [gt + 1]: oldGt } : {} }),
            { at: "more", ...f() },
          );
        } else {
          i++; hl = i - 1;
          snap("等于 pivot", `${x} 等于 pivot，留在中间的等于区，i 前进。`, view(), { at: "eq", ...f() });
        }
      }
      hl = -1;
      const parts = `小于区 [${lo}, ${lt - 1}]，等于区 [${lt}, ${gt}]，大于区 [${gt + 1}, ${hi}]`;
      const prevRange = `[${lo}, ${hi}]`;
      if (target < lt) {
        hi = lt - 1; pv = null;
        snap("去左边", `划分完了：${parts}。目标下标 ${target} 在小于区，右边两段直接扔掉，范围缩成 [${lo}, ${hi}]。`, view(), { at: "left", ...f(prevRange) });
      } else if (target > gt) {
        lo = gt + 1; pv = null;
        snap("去右边", `划分完了：${parts}。目标下标 ${target} 在大于区，左边两段直接扔掉，范围缩成 [${lo}, ${hi}]。`, view(), { at: "right", ...f(prevRange) });
      } else {
        done = target;
        snap("找到", `划分完了：${parts}。目标下标 ${target} 落在等于区，答案就是 pivot <b>${pv}</b>。`, view(), { at: "found", kind: "ok", ans: pv, ...f() });
        return;
      }
    }
  },
  points: [
    { t: "pivot 要随机", body: "固定取第一个，遇到有序数组会退化成 O(n²)。" },
    { t: "三路划分", body: "等于 pivot 的数单独放中间，全是重复元素的用例一轮就结束。" },
    { t: "换过来的数还没看过", body: "和 gt 交换后，i 不能前进，换过来的那个数还要再比一次。" },
    { t: "复杂度", body: "平均时间 O(n)，原地划分额外空间 O(1)。" },
  ],
};
