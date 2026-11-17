module.exports = {
  slug: "heap-sort", name: "堆排序与 Top K", kind: "algo", order: 4,
  lede: "把数组原地调成最大堆，堆顶就是最大的数；把它和末尾交换，末尾就排好了一个，剩下的再调成堆。重复 n 次就排好了，不用额外空间。Top K 问题反过来用堆：只留一个大小为 k 的最小堆，堆顶就是第 k 大。",
  related: [215, 347, 295, 23],
  sections: [{
    key: "sort", t: "堆排序",
    body: [
      "第一步<b>建堆</b>：把数组看成完全二叉树（i 的孩子是 2i+1、2i+2），从最后一个非叶子节点 <code>n // 2 - 1</code> 开始往前，逐个<b>下沉</b>（和更大的孩子交换，直到不比孩子小）。做完整个数组就是最大堆，总共 O(n)。",
      "第二步<b>取最大</b>：堆顶 <code>nums[0]</code> 是最大的，和堆的最后一个数交换，它就到了最终位置；堆的大小减一，新的堆顶下沉，恢复成堆。重复到堆里只剩一个数。",
      "时间 O(n log n)，空间 O(1)，但不稳定。下沉的写法和「堆」专题里一样，只是这里是最大堆。",
    ],
    points: [
      { t: "下沉时传入堆的大小", body: "排好的数已经放在数组末尾，下沉时只能看 <code>[0, end)</code> 这一段，不能把它们又换回来。" },
      { t: "为什么从 n//2-1 开始", body: "下标比它大的都是叶子，单独一个节点本来就是堆，不用下沉。" },
    ],
    codes: [{ t: "原地堆排序", key: "sort", code: `
class Solution:
    def sortArray(self, nums: List[int]) -> List[int]:
        def sift_down(i: int, n: int) -> None:  # 在 nums[0..n-1] 这个最大堆里让 nums[i] 下沉
            while True:
                big, l, r = i, 2 * i + 1, 2 * i + 2
                if l < n and nums[l] > nums[big]:
                    big = l
                if r < n and nums[r] > nums[big]:
                    big = r
                if big == i:
                    return
                nums[i], nums[big] = nums[big], nums[i]
                i = big
        n = len(nums)
        for i in range(n // 2 - 1, -1, -1):     # 建最大堆：从最后一个非叶子往前下沉 #@build
            sift_down(i, n)                     #@build
        for end in range(n - 1, 0, -1):         #@pick
            nums[0], nums[end] = nums[end], nums[0]     # 堆顶（最大）换到末尾 #@pick
            sift_down(0, end)                   # 剩下的 end 个数重新调成堆 #@fix
        return nums                             #@done
` }],
    sig: { fn: "sortArray", params: ["int[]"], ret: "int[]" },
    call: (a) => [a.nums],
    cases: [[[5, 2, 3, 1]], [[5, 1, 1, 2, 0, 0]], [[7]], [[2, 2, 2]]],
    gen: (R) => { const nums = R.arr(R.int(4, 8), 1, 15); return { args: { nums }, note: `nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["a", "刚下沉 / 交换过的位置"], ["c", "已经排好"]],
      presets: [{ label: "示例", args: { nums: [4, 10, 3, 5, 1, 8, 7] }, note: "nums = [4,10,3,5,1,8,7]", expect: [1, 3, 4, 5, 7, 8, 10] }],
      build(a, snap) {
        const nums = a.nums.slice(), n = nums.length;
        let end = n, hot = [];
        const view = () => {
          const N = {}, cls = {};
          for (let i = 0; i < end; i++) { N[i] = { v: nums[i], l: 2 * i + 1 < end ? 2 * i + 1 : null, r: 2 * i + 2 < end ? 2 * i + 2 : null }; cls[i] = hot.includes(i) ? "a" : ""; }
          return [
            end ? { t: "tree", label: `堆（前 ${end} 个数）`, nodes: N, root: 0, cls } : { t: "note", label: "堆", html: "空" },
            { t: "array", label: "nums", items: nums.map((v, i) => ({ v, cls: i >= end ? "c" : hot.includes(i) ? "a" : "" })) },
          ];
        };
        const sift = (i, m) => {
          const path = [i];
          for (;;) {
            let b = i; const l = 2 * i + 1, r = 2 * i + 2;
            if (l < m && nums[l] > nums[b]) b = l;
            if (r < m && nums[r] > nums[b]) b = r;
            if (b === i) return path;
            [nums[i], nums[b]] = [nums[b], nums[i]]; i = b; path.push(i);
          }
        };
        snap("开始", "把数组看成一棵完全二叉树。先把它调成最大堆。", view(), { at: "build" });
        for (let i = (n >> 1) - 1; i >= 0; i--) {
          const v = nums[i], path = sift(i, n);
          hot = path;
          snap("建堆：下沉", path.length > 1 ? `下标 ${i} 的 ${v} 比孩子小，一路下沉到下标 ${path[path.length - 1]}。` : `下标 ${i} 的 ${v} 不比孩子小，不用动。`, view(), { at: "build" });
        }
        hot = [];
        snap("堆建好了", `最大堆建好了，堆顶 ${nums[0]} 是最大的数。`, view(), { at: "build" });
        for (let e = n - 1; e > 0; e--) {
          [nums[0], nums[e]] = [nums[e], nums[0]];
          hot = [0]; end = e;
          snap("堆顶换到末尾", `把堆顶 ${nums[e]} 和下标 ${e} 的 ${nums[0]} 交换，${nums[e]} 到了最终位置，堆里还剩 ${e} 个数。`, view(), { at: "pick" });
          const v = nums[0], path = sift(0, end);
          hot = path;
          snap("重新调成堆", `剩下的 ${end} 个数里，新堆顶 ${v} 下沉${path.length > 1 ? `到下标 ${path[path.length - 1]}` : "（不用动）"}，堆顶又是最大的了。`, view(), { at: "fix" });
        }
        hot = []; end = 0;
        snap("完成", `排好了：[${nums.join(", ")}]。`, view(), { at: "done", kind: "ok", ans: nums.slice() });
      },
    },
  }, {
    key: "topk", t: "Top K：大小为 k 的最小堆",
    body: [
      "数据一个个到来，随时要回答「目前第 k 大的数是多少」。只维护<b>最大的 k 个数</b>就够了，并且放在一个<b>最小堆</b>里：堆顶是这 k 个里最小的，正好就是第 k 大。",
      "新来一个数先放进堆；堆里超过 k 个，就弹出堆顶——它比另外 k 个都小，不可能再是前 k 大。每次 O(log k)，比每次排序快得多。",
      "反过来，求第 k 小就用大小为 k 的最大堆。数据全部已知时还可以用快速选择，平均 O(n)。",
    ],
    points: [
      { t: "堆的方向别弄反", body: "求「前 k 大」用<b>最小</b>堆：要随时踢掉这 k 个里最小的那个。" },
      { t: "各语言的最小堆", body: "Python <code>heapq</code>，Java <code>PriorityQueue</code>，C++ <code>priority_queue&lt;int, vector&lt;int&gt;, greater&lt;int&gt;&gt;</code>，Go <code>container/heap</code>；JavaScript 要自己写（力扣上有 <code>MinPriorityQueue</code>）。" },
    ],
    codes: [{ t: "最小堆只留 k 个", key: "topk", code: `
class KthLargest:
    def __init__(self, k: int, nums: List[int]):
        self.k = k
        self.heap = []                      # 最小堆，只留最大的 k 个数 #@init
        for x in nums:                      #@init
            self.add(x)                     #@init

    def add(self, val: int) -> int:
        heapq.heappush(self.heap, val)      #@push
        if len(self.heap) > self.k:         # 多了一个：最小的那个不可能是前 k 大 #@trim
            heapq.heappop(self.heap)        #@trim
        return self.heap[0]                 # 堆顶就是第 k 大 #@top
` }],
    sig: { cls: "KthLargest", ctor: ["int", "int[]"], methods: { add: [["int"], "int"] } },
    call: (a) => [["KthLargest", ...a.adds.map(() => "add")], [[a.k, a.nums], ...a.adds.map((x) => [x])]],
    cases: [[["KthLargest", "add", "add", "add", "add", "add"], [[3, [4, 5, 8, 2]], [3], [5], [10], [9], [4]]], [["KthLargest", "add", "add"], [[1, []], [-3], [-2]]], [["KthLargest", "add", "add"], [[2, [0]], [-1], [1]]]],
    gen: (R) => {
      const k = R.int(1, 4), nums = R.arr(R.int(k - 1, k + 3), 1, 20), adds = R.arr(R.int(3, 6), 1, 20);
      return { args: { k, nums, adds }, note: `k = ${k}, nums = ${R.fmt(nums)}，依次 add ${adds.join("、")}` };
    },
    demo: {
      legend: [["a", "刚放进来的数"], ["d", "被弹出的数"], ["c", "堆顶：第 k 大"]],
      presets: [{ label: "示例", args: { k: 3, nums: [4, 5, 8, 2], adds: [3, 5, 10, 9, 4] }, note: "k = 3, nums = [4,5,8,2]，依次 add 3、5、10、9、4", expect: [null, 4, 5, 5, 8, 8] }],
      build(a, snap) {
        const k = a.k, heap = [], out = [null];
        let fresh = null, gone = null;
        const view = () => [
          { t: "chips", label: `最小堆（最多 ${k} 个，从小到大排给你看，左边是堆顶）`, items: heap.slice().sort((x, y) => x - y).map((v, i) => ({ v, cls: i === 0 && heap.length === k ? "c" : v === fresh ? "a" : "" })), empty: "空" },
          { t: "chips", label: "弹出的", items: gone === null ? [] : [{ v: gone, cls: "d" }], empty: "无" },
          { t: "chips", label: "add 的返回值", items: out.slice(1), empty: "还没有" },
        ];
        const add = (x, init) => {
          heap.push(x); fresh = x; gone = null;
          let trimmed = false;
          if (heap.length > k) { heap.sort((p, q) => p - q); gone = heap.shift(); trimmed = true; }
          snap(init ? `初始化：放进 ${x}` : `add(${x})`, `${x} 放进堆。` + (trimmed ? `堆里超过 ${k} 个了，弹出堆顶 ${gone}：它比另外 ${k} 个都小，不可能是前 ${k} 大。` : `堆里有 ${heap.length} 个，还没超过 ${k}。`), view(), { at: init ? ["init", "push", ...(trimmed ? ["trim"] : [])] : trimmed ? ["push", "trim"] : "push" });
        };
        snap("开始", `k = ${k}。先把 nums 里的数一个个加进去。`, view(), { at: "init" });
        for (const x of a.nums) add(x, true);
        for (const x of a.adds) {
          add(x, false);
          const top = Math.min(...heap); out.push(top); fresh = null;
          snap("返回堆顶", `堆顶 ${top} 是这 ${k} 个里最小的，就是第 ${k} 大，返回 ${top}。`, view(), { at: "top" });
        }
        gone = null;
        snap("完成", `每次 add 只做 O(log ${k}) 的堆操作。`, view(), { at: [], kind: "ok", ans: out });
      },
    },
  }],
};
