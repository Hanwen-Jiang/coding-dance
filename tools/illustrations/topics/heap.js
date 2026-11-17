module.exports = {
  slug: "heap", name: "堆", kind: "ds", order: 5,
  lede: "堆是一棵完全二叉树，每个节点都不大于它的孩子（最小堆），所以堆顶永远是最小值。它存在一个数组里，取最小值 O(1)，插入和删除堆顶 O(log n)。「随时要拿当前最小 / 最大的那个」就用堆，也叫优先队列。",
  related: [215, 347, 295, 23],
  sections: [{
    key: "sift", t: "手写最小堆：上浮和下沉",
    body: [
      "完全二叉树按层从左到右编号，正好排成一个数组：下标 i 的孩子是 <code>2i + 1</code> 和 <code>2i + 2</code>，父节点是 <code>(i - 1) // 2</code>。不用指针，也没有空位。",
      "<b>插入</b>：先放到数组末尾，再<b>上浮</b>：比父节点小就和父节点交换，直到不比父节点小或者到了堆顶。",
      "<b>弹出堆顶</b>：把最后一个元素挪到堆顶，再<b>下沉</b>：和两个孩子里更小的那个比，比它大就交换，直到两个孩子都不比它小。两种操作都只沿着一条路径走，O(log n)。",
    ],
    points: [
      { t: "下沉时选更小的孩子", body: "和更小的孩子交换，换上来的才比另一个孩子小，堆的性质才保得住。" },
      { t: "建堆可以 O(n)", body: "把数组从最后一个非叶子节点往前逐个下沉，总共 O(n)，比一个个插入的 O(n log n) 快。Python 的 <code>heapify</code> 就是这样做的。" },
    ],
    codes: [{ t: "数组上的最小堆", key: "sift", code: `
class MinHeap:
    def __init__(self):
        self.a = []                             # i 的孩子是 2i+1、2i+2 #@init

    def push(self, x: int) -> None:
        a = self.a
        a.append(x)                             # 先放到最后 #@push
        i = len(a) - 1                          #@push
        while i > 0 and a[(i - 1) // 2] > a[i]: # 比父节点小就往上换 #@up
            p = (i - 1) // 2                    #@up
            a[i], a[p] = a[p], a[i]             #@up
            i = p                               #@up

    def pop(self) -> int:
        a = self.a
        top = a[0]                              #@pop
        a[0] = a[-1]                            # 最后一个挪到堆顶 #@pop
        a.pop()                                 #@pop
        i = 0
        while True:
            small, l, r = i, 2 * i + 1, 2 * i + 2   #@down
            if l < len(a) and a[l] < a[small]:  #@down
                small = l                       #@down
            if r < len(a) and a[r] < a[small]:  #@down
                small = r                       #@down
            if small == i:                      # 两个孩子都不比它小 #@stop
                break                           #@stop
            a[i], a[small] = a[small], a[i]     #@down
            i = small                           #@down
        return top                              #@ret

    def peek(self) -> int:
        return self.a[0]                        #@peek

    def size(self) -> int:
        return len(self.a)                      #@size
` }],
    sig: { cls: "MinHeap", ctor: [], methods: { push: [["int"], "void"], pop: [[], "int"], peek: [[], "int"], size: [[], "int"] } },
    call: (a) => [["MinHeap", ...a.ops.map((o) => o[0])], [[], ...a.ops.map((o) => o.slice(1))]],
    cases: [[["MinHeap", "push", "peek", "pop", "size"], [[], [3], [], [], []]], [["MinHeap", "push", "push", "push", "push", "pop", "pop", "pop", "pop"], [[], [2], [2], [1], [2], [], [], [], []]]],
    gen: (R) => {
      const ops = [];
      let size = 0;
      for (let k = R.int(7, 11); k > 0; k--) {
        const o = size === 0 || R.chance(0.55) ? "push" : R.pick(["pop", "pop", "peek", "size"]);
        if (o === "push") { ops.push(["push", R.int(1, 20)]); size++; } else { ops.push([o]); if (o === "pop") size--; }
      }
      return { args: { ops }, note: ops.map((o) => (o.length > 1 ? `${o[0]}(${o[1]})` : `${o[0]}()`)).join(" ") };
    },
    demo: {
      legend: [["a", "正在上浮 / 下沉的元素"], ["b", "和它比较的节点"], ["c", "刚弹出的堆顶"]],
      presets: [{ label: "示例", args: { ops: [["push", 5], ["push", 8], ["push", 3], ["push", 9], ["push", 1], ["pop"], ["pop"], ["peek"]] }, note: "push(5) push(8) push(3) push(9) push(1) pop() pop() peek()", expect: [null, null, null, null, null, null, 1, 3, 5] }],
      build(a, snap) {
        const h = [], out = [null];
        const view = (cur, cmp) => {
          const N = {}, cls = {};
          h.forEach((v, i) => { N[i] = { v, l: 2 * i + 1 < h.length ? 2 * i + 1 : null, r: 2 * i + 2 < h.length ? 2 * i + 2 : null }; cls[i] = i === cur ? "a" : i === cmp ? "b" : ""; });
          return [
            h.length ? { t: "tree", label: "堆（完全二叉树）", nodes: N, root: 0, cls } : { t: "note", label: "堆（完全二叉树）", html: "空" },
            { t: "array", label: "存在数组里", items: h.map((v, i) => ({ v, cls: cls[i] })) },
            { t: "chips", label: "返回值", items: out.map((x) => (x === null ? "null" : String(x))) },
          ];
        };
        snap("开始", "空堆。", view(), { at: "init" });
        for (const [op, x] of a.ops) {
          if (op === "push") {
            h.push(x); out.push(null);
            let i = h.length - 1;
            snap(`push(${x})`, `${x} 先放到数组末尾，下标 ${i}。`, view(i), { at: "push" });
            while (i > 0 && h[(i - 1) >> 1] > h[i]) {
              const p = (i - 1) >> 1;
              [h[i], h[p]] = [h[p], h[i]];
              snap("上浮", `${x} 比父节点 ${h[i]} 小，交换。`, view(p, i), { at: "up" });
              i = p;
            }
            snap("上浮结束", i === 0 ? `${x} 到了堆顶。` : `${x} 不比父节点 ${h[(i - 1) >> 1]} 小，停下。`, view(i), { at: "up" });
          } else if (op === "pop") {
            const top = h[0], last = h.pop();
            out.push(top);
            if (!h.length) { snap("pop()", `只有一个元素 ${top}，直接弹出。`, view(), { at: ["pop", "ret"] }); continue; }
            h[0] = last;
            snap("pop()", `弹出堆顶 ${top}。把最后一个元素 ${last} 挪到堆顶。`, view(0), { at: "pop" });
            let i = 0;
            for (;;) {
              let s = i; const l = 2 * i + 1, r = 2 * i + 2;
              if (l < h.length && h[l] < h[s]) s = l;
              if (r < h.length && h[r] < h[s]) s = r;
              if (s === i) { snap("下沉结束", `${h[i]} 的孩子都不比它小（或者没有孩子），停下。返回 ${top}。`, view(i), { at: ["stop", "ret"] }); break; }
              snap("下沉", `${h[i]} 的孩子里更小的是 ${h[s]}，比它小，交换。`, view(i, s), { at: "down" });
              [h[i], h[s]] = [h[s], h[i]];
              i = s;
            }
          } else if (op === "peek") { out.push(h[0]); snap("peek()", `堆顶 ${h[0]} 就是最小值，O(1)。`, view(0), { at: "peek" }); }
          else { out.push(h.length); snap("size()", `堆里有 ${h.length} 个元素。`, view(), { at: "size" }); }
        }
        snap("完成", "每次操作只沿一条从根到叶的路径走。", view(), { at: [], kind: "ok", ans: out });
      },
    },
  }, {
    key: "builtin", t: "各语言内置的堆",
    body: [
      "平时不用手写，各语言都有现成的：Python <code>heapq</code>（在列表上操作，只有最小堆），Java <code>PriorityQueue</code>（默认最小堆，传比较器变最大堆），C++ <code>priority_queue</code>（默认<b>最大堆</b>），Go 的 <code>container/heap</code>（自己的类型实现 5 个方法）。JavaScript 没有内置的堆：力扣的 JavaScript 环境里有 <code>MaxPriorityQueue</code> / <code>MinPriorityQueue</code>，自己的项目里就要手写一个。",
      "例题：每次取最重的两块石头相撞，留下差值。「每次取最大的两个」正是最大堆的用法。Python 只有最小堆，常用技巧是存相反数。",
    ],
    points: [
      { t: "最大堆的写法", body: "Python 存 <code>-x</code>；Java <code>new PriorityQueue&lt;&gt;((a, b) -&gt; b - a)</code>（数很大时用 <code>Integer.compare(b, a)</code> 防溢出）；C++ 默认就是；Go 的 <code>Less</code> 写成 <code>h[i] &gt; h[j]</code>。" },
      { t: "C++ 的最小堆", body: "<code>priority_queue&lt;int, vector&lt;int&gt;, greater&lt;int&gt;&gt;</code>。" },
    ],
    codes: [{ t: "用内置的堆", key: "builtin", code: `
class Solution:
    def lastStoneWeight(self, stones: List[int]) -> int:
        heap = [-x for x in stones]             # heapq 是最小堆，存相反数当最大堆用 #@init
        heapq.heapify(heap)                     # O(n) 建堆 #@init
        while len(heap) > 1:                    #@loop
            y = -heapq.heappop(heap)            # 最重的 #@pop
            x = -heapq.heappop(heap)            # 第二重的 #@pop
            if x != y:                          #@push
                heapq.heappush(heap, -(y - x))  # 碎了还剩 y - x #@push
        return -heap[0] if heap else 0          #@done
` }],
    sig: { fn: "lastStoneWeight", params: ["int[]"], ret: "int" },
    call: (a) => [a.stones],
    cases: [[[2, 7, 4, 1, 8, 1]], [[1]], [[3, 3]], [[10, 4, 2, 10]]],
    gen: (R) => { const stones = R.arr(R.int(2, 7), 1, 12); return { args: { stones }, note: `stones = ${R.fmt(stones)}` }; },
    demo: {
      legend: [["a", "这次拿出来的两块"], ["c", "碎完剩下的"]],
      presets: [{ label: "示例 1", args: { stones: [2, 7, 4, 1, 8, 1] }, note: "stones = [2,7,4,1,8,1]", expect: 1 }],
      build(a, snap) {
        let heap = a.stones.slice(), took = [], made = null;
        const view = () => [
          { t: "chips", label: "最大堆里的石头（从重到轻排给你看）", items: heap.slice().sort((x, y) => y - x).map((v) => ({ v, cls: v === made ? "c" : "" })), empty: "空" },
          { t: "chips", label: "拿出来的两块", items: took.map((v) => ({ v, cls: "a" })), empty: "无" },
        ];
        snap("建堆", `把 ${heap.length} 块石头放进最大堆。`, view(), { at: "init" });
        while (heap.length > 1) {
          heap.sort((x, y) => y - x);
          const y = heap.shift(), x = heap.shift();
          took = [y, x]; made = null;
          snap("取两块", `堆顶弹出两次：最重的 ${y}，第二重的 ${x}。`, view(), { at: ["loop", "pop"] });
          if (x !== y) { made = y - x; heap.push(made); snap("相撞", `${y} ≠ ${x}，碎了还剩 ${y} - ${x} = ${made}，放回堆里。`, view(), { at: "push" }); }
          else snap("相撞", `一样重，两块都碎了。`, view(), { at: "push" });
          took = [];
        }
        const ans = heap.length ? heap[0] : 0;
        snap("完成", heap.length ? `只剩一块，重 ${ans}。` : "石头都碎了，返回 0。", view(), { at: ["loop", "done"], kind: "ok", ans });
      },
    },
  }],
};
