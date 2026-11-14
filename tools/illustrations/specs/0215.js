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
        target = len(nums) - k          # 第 k 大 = 升序下标 n-k
        lo, hi = 0, len(nums) - 1
        while True:
            pivot = nums[random.randint(lo, hi)]
            lt, i, gt = lo, lo, hi      # [lo,lt) 小于  [lt,i) 等于  (gt,hi] 大于
            while i <= gt:
                if nums[i] < pivot:
                    nums[lt], nums[i] = nums[i], nums[lt]
                    lt += 1
                    i += 1
                elif nums[i] > pivot:
                    nums[i], nums[gt] = nums[gt], nums[i]
                    gt -= 1             # 换过来的数还没看过，i 不动
                else:
                    i += 1
            if target < lt:
                hi = lt - 1             # 答案在小于区
            elif target > gt:
                lo = gt + 1             # 答案在大于区
            else:
                return pivot            # 落在等于区，就是 pivot
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
` }, { t: "另一种常考写法：大小为 k 的小顶堆", note: "堆里始终保留目前见过的最大的 k 个数，堆顶是其中最小的，也就是第 k 大。复杂度 O(n log k)，写起来短、不改原数组。", code: `
import heapq

class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        heap = nums[:k]
        heapq.heapify(heap)             # 先放前 k 个，建小顶堆
        for x in nums[k:]:
            if x > heap[0]:             # 比堆顶大，才有资格进前 k
                heapq.heapreplace(heap, x)
        return heap[0]
` }],
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
    note: "堆里始终留着目前见过的最大的 k 个数，堆顶是其中最小的。新来的数比堆顶大才有资格进去，把堆顶换掉。",
    legend: [["a", "正在看的数"], ["d", "已经看过"], ["b", "堆顶：目前的第 k 大"], ["c", "答案"]],
    build(a, snap) {
      const nums = a.nums.slice(), n = nums.length, k = a.k;
      const heap = [];
      const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p] <= heap[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const down = (i) => { for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } };
      const nodes = () => { const N = {}; heap.forEach((v, i) => (N[i] = { v, l: 2 * i + 1 < heap.length ? 2 * i + 1 : null, r: 2 * i + 2 < heap.length ? 2 * i + 2 : null })); return N; };
      const view = (j, fin) => [
        { t: "array", label: "nums", items: nums.map((v, t) => ({ v, cls: t === j ? "a" : t < j ? "d" : "" })), ptrs: {} },
        heap.length ? { t: "tree", label: `小顶堆（最多 ${k} 个，堆顶是其中最小的）`, nodes: nodes(), root: 0, cls: { 0: fin ? "c" : "b" } } : { t: "note", label: "小顶堆", html: "空" },
      ];
      const f = () => ({ facts: [["堆大小", `${heap.length} / ${k}`], ["堆顶", heap.length ? heap[0] : "—"]] });
      snap("开始", `堆里只留目前见过的最大的 ${k} 个数。全部看完后，堆顶就是第 ${k} 大。`, view(-1), f());
      nums.forEach((x, j) => {
        if (heap.length < k) { heap.push(x); up(heap.length - 1); snap("入堆", `堆里还不到 ${k} 个，${x} 直接放进去，调整后堆顶是 ${heap[0]}。`, view(j), f()); }
        else if (x > heap[0]) { const old = heap[0]; heap[0] = x; down(0); snap("替换堆顶", `${x} 比堆顶 ${old} 大，有资格进前 ${k}。换掉堆顶再往下调整，新的堆顶是 ${heap[0]}。`, view(j), f()); }
        else snap("跳过", `${x} 不比堆顶 ${heap[0]} 大，进不了前 ${k}，跳过。`, view(j), f());
      });
      snap("完成", `看完了，堆顶 <b>${heap[0]}</b> 就是第 ${k} 大的数。`, view(n, true), { kind: "ok", ans: heap[0], ...f() });
    },
  }],
  build(a, snap) {
    const nums = a.nums.slice(), n = nums.length, k = a.k;
    const target = n - k;
    let lo = 0, hi = n - 1, lt = 0, i = 0, gt = n - 1, pv = null, hl = -1, done = -1;
    const cls = (j) => (j === done ? "c" : j < lo || j > hi ? "d" : j === hl ? "a" : pv === null ? "e" : j < lt ? "g" : j < i ? "k" : j > gt ? "w" : "e");
    const view = () => [{ t: "bars", label: `nums（目标是升序后下标 ${target} 的数）`, items: nums.map((v, j) => ({ v, cls: cls(j) })), ptrs: pv === null ? { lo, hi } : { lt, i: i <= gt ? i : null, gt } }];
    const f = () => ({ facts: [["目标下标", target], ["范围", `[${lo}, ${hi}]`], ["pivot", pv === null ? "—" : pv]] });
    snap("开始", `第 ${k} 大，就是升序排好后下标 ${n} − ${k} = <b>${target}</b> 的数。只关心这一个位置放的是谁。`, view(), f());
    for (;;) {
      pv = nums[(lo + hi) >> 1]; lt = lo; i = lo; gt = hi; hl = -1;
      snap("选 pivot", `这一轮的范围是 [${lo}, ${hi}]。演示里取中间位置的 <b>${pv}</b> 当 pivot（代码里是随机选的）。`, view(), f());
      while (i <= gt) {
        const x = nums[i];
        if (x < pv) { [nums[lt], nums[i]] = [nums[i], nums[lt]]; lt++; i++; hl = lt - 1; snap("小于", `${x} &lt; ${pv}，放到左边的小于区。`, view(), f()); }
        else if (x > pv) { [nums[i], nums[gt]] = [nums[gt], nums[i]]; gt--; hl = gt + 1; snap("大于", `${x} &gt; ${pv}，换到右边的大于区。换过来的 ${nums[i]} 还没看过，i 不动。`, view(), f()); }
        else { i++; hl = i - 1; snap("等于", `${x} 等于 pivot，留在中间的等于区。`, view(), f()); }
      }
      hl = -1;
      const parts = `小于区 [${lo}, ${lt - 1}]，等于区 [${lt}, ${gt}]，大于区 [${gt + 1}, ${hi}]`;
      if (target < lt) { snap("去左边", `划分完了：${parts}。目标下标 ${target} 在小于区，右边两段直接扔掉。`, view(), f()); hi = lt - 1; pv = null; }
      else if (target > gt) { snap("去右边", `划分完了：${parts}。目标下标 ${target} 在大于区，左边两段直接扔掉。`, view(), f()); lo = gt + 1; pv = null; }
      else { done = target; snap("找到", `划分完了：${parts}。目标下标 ${target} 落在等于区，答案就是 pivot <b>${pv}</b>。`, view(), { kind: "ok", ans: pv, ...f() }); return; }
    }
  },
  points: [
    { t: "pivot 要随机", body: "固定取第一个，遇到有序数组会退化成 O(n²)。" },
    { t: "三路划分", body: "等于 pivot 的数单独放中间，全是重复元素的用例一轮就结束。" },
    { t: "换过来的数还没看过", body: "和 gt 交换后，i 不能前进，换过来的那个数还要再比一次。" },
    { t: "复杂度", body: "平均时间 O(n)，原地划分额外空间 O(1)。" },
  ],
};
