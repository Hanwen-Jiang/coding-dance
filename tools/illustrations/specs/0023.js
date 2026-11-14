module.exports = {
  id: 23, name: "合并 K 个升序链表", title: "合并 K 个升序链表图解", level: "困难", topic: "链表",
  h1: "合并 K 个升序链表，让堆告诉你谁最小",
  lede: "合并两个链表时，每次比较两个头就行。有 k 个链表时，要在 k 个头里找最小的。把这 k 个头放进一个小顶堆，每次弹出最小的接到结果上，再把它后面的节点补进堆里。",
  hints: [
    { t: "和合并两个链表的关系", body: ["思路一样：下一个要接的节点，一定是某个链表当前的头。", "区别只是候选从 2 个变成了 k 个，逐个比较要 <code>O(k)</code>。"] },
    { t: "用堆找最小", body: ["小顶堆里放每个链表当前的头节点，取最小值和放入新值都是 <code>O(log k)</code>。", "堆里始终最多 k 个节点。"] },
    { t: "弹出之后", body: ["弹出的节点接到结果后面。如果它后面还有节点，把后面那个放进堆，代表这个链表新的头。", "堆空了，就合并完了。"] },
  ],
  codes: [{ t: "标准解法：小顶堆", code: `
class Solution:
    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:
        # 堆里放 (值, 链表编号, 节点)，编号用来在值相等时比较
        heap = [(node.val, i, node) for i, node in enumerate(lists) if node]
        heapq.heapify(heap)
        dummy = cur = ListNode()
        while heap:
            val, i, node = heapq.heappop(heap)
            cur.next = node
            cur = node
            if node.next:
                heapq.heappush(heap, (node.next.val, i, node.next))
        return dummy.next
` }, { t: "另一种写法：分治，两两合并", note: "把 k 个链表对半分，两半各自合并成一个，再合并这两个。复杂度同样是 O(n log k)。", code: `
class Solution:
    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:
        def merge2(a, b):
            dummy = cur = ListNode()
            while a and b:
                if a.val <= b.val:
                    cur.next, a = a, a.next
                else:
                    cur.next, b = b, b.next
                cur = cur.next
            cur.next = a or b
            return dummy.next

        if not lists:
            return None
        while len(lists) > 1:
            lists = [merge2(lists[i], lists[i + 1] if i + 1 < len(lists) else None)
                     for i in range(0, len(lists), 2)]
        return lists[0]
` }, { t: "简洁写法：heapq.merge", kind: "elegant", note: "heapq.merge 内部就是小顶堆多路归并。每条链表包成一个生成器，按节点的值合并，再把节点依次串起来。", code: `
class Solution:
    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:
        def walk(node):
            while node:
                yield node
                node = node.next
        dummy = tail = ListNode()
        for node in heapq.merge(*map(walk, lists), key=lambda n: n.val):
            tail.next = tail = node
        tail.next = None
        return dummy.next
` }],
  pytest: `
s = Solution()
assert toL(s.mergeKLists([L([1,4,5]), L([1,3,4]), L([2,6])])) == [1,1,2,3,4,4,5,6]
assert toL(s.mergeKLists([])) == []
assert toL(s.mergeKLists([L([])])) == []
for _ in range(100):
    ls = [sorted(random.randint(-9, 9) for _ in range(random.randint(0, 6))) for _ in range(random.randint(0, 6))]
    assert toL(s.mergeKLists([L(x) for x in ls])) == sorted(sum(ls, []))
`,
  method: "小顶堆",
  legend: [["a", "在堆里的头节点"], ["d", "已经接走"], ["c", "刚弹出的最小值"], ["k", "结果"]],
  presets: [
    { label: "示例 1", args: { ls: [[1, 4, 5], [1, 3, 4], [2, 6]] }, note: "lists = [[1,4,5],[1,3,4],[2,6]]", expect: [1, 1, 2, 3, 4, 4, 5, 6] },
    { label: "四个链表", args: { ls: [[3, 9], [1, 7, 8], [2], [4, 5, 6]] }, note: "lists = [[3,9],[1,7,8],[2],[4,5,6]]", expect: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
  build(a, snap) {
    const ls = a.ls, pos = ls.map(() => 0), out = []; let heap = [], popped = null;
    const sortHeap = () => heap.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const view = () => [
      ...ls.map((l, i) => ({ t: "chips", label: `链表 ${i}`, items: l.map((v, j) => ({ v, cls: j < pos[i] ? "d" : j === pos[i] ? (popped === i ? "c" : "a") : "" })) })),
      { t: "chips", label: "小顶堆（按值排好，最左边是堆顶；写的是 值 @ 链表编号）", items: heap.map(([v, i], t) => ({ v: `${v} @${i}`, cls: t === 0 ? "e" : "" })) },
      { t: "chips", label: "结果", items: out.map((v) => ({ v, cls: "k" })), empty: "还没有" },
    ];
    ls.forEach((l, i) => { if (l.length) heap.push([l[0], i]); });
    sortHeap();
    snap("建堆", `把 ${ls.length} 个链表的头节点都放进小顶堆。`, view());
    while (heap.length) {
      const [v, i] = heap.shift();
      popped = i;
      snap("弹出最小值", `堆顶是 ${v}，来自链表 ${i}。它是所有头节点里最小的，弹出来接到结果后面。`, view());
      out.push(v); pos[i]++; popped = null;
      const nx = ls[i][pos[i]];
      if (nx !== undefined) { heap.push([nx, i]); sortHeap(); snap("补进下一个", `链表 ${i} 的下一个节点是 ${nx}，把它放进堆，作为这个链表新的头。`, view()); }
      else snap("这个链表走完了", `链表 ${i} 后面没有节点了，不用补。堆里剩 ${heap.length} 个。`, view(), { kind: "warn" });
    }
    snap("完成", `堆空了，所有节点都接好了：[${out.join(", ")}]。`, view(), { kind: "ok", ans: out });
  },
  alts: [{
    t: "分治两两合并",
    note: "和「另一种写法」一样：每一轮把相邻的两个链表合并成一个（就是「合并两个有序链表」），链表个数减半，直到只剩一个。",
    legend: [["a", "正在合并的两个"], ["d", "这一轮已经合并过"], ["c", "刚合并出来的"]],
    build(a, snap) {
      let ls = a.ls.map((l) => l.slice()), round = 0;
      const merge2 = (p, q) => { const r = []; let i = 0, j = 0; while (i < p.length && j < q.length) r.push(p[i] <= q[j] ? p[i++] : q[j++]); return r.concat(p.slice(i), q.slice(j)); };
      const view = (hl, nx) => [
        ...ls.map((l, i) => ({ t: "chips", label: `${nx ? "这一轮 · " : ""}链表 ${i}`, items: l.map((v) => ({ v, cls: hl.includes(i) ? "a" : nx && i < Math.min(...hl) ? "d" : "" })), empty: "空" })),
        ...(nx || []).map((l, t) => ({ t: "chips", label: `下一轮 · 链表 ${t}`, items: l.map((v) => ({ v, cls: t === nx.length - 1 ? "c" : "" })), empty: "空" })),
      ];
      if (!ls.length) { snap("完成", "没有链表，返回空。", [{ t: "note", label: "lists", html: "空" }], { kind: "ok", ans: [] }); return; }
      snap("开始", `一共 ${ls.length} 个链表。每一轮把相邻的两个合并成一个，个数减半。`, view([], null));
      while (ls.length > 1) {
        round++;
        const nx = [];
        for (let i = 0; i < ls.length; i += 2) {
          if (i + 1 < ls.length) {
            nx.push(merge2(ls[i], ls[i + 1]));
            snap(`第 ${round} 轮`, `合并链表 ${i} 和链表 ${i + 1}：两个头比大小，小的先接上，得到 [${nx[nx.length - 1].join(", ")}]。`, view([i, i + 1], nx));
          } else {
            nx.push(ls[i]);
            snap(`第 ${round} 轮`, `链表 ${i} 落单了，和空链表合并等于它自己，原样进入下一轮。`, view([i], nx));
          }
        }
        ls = nx;
        snap(`第 ${round} 轮完`, ls.length > 1 ? `还剩 ${ls.length} 个链表，继续下一轮。` : "只剩一个链表了。", view([], null));
      }
      snap("完成", `合并完成：[${ls[0].join(", ")}]。一共 ${round} 轮，每轮每个节点只被处理一次，所以是 O(n log k)。`, view([], null), { kind: "ok", ans: ls[0] });
    },
  }],
  points: [
    { t: "堆里要放编号", body: "值相等时 Python 会接着比较元组的下一项。<code>ListNode</code> 不能比较大小，所以中间放一个链表编号。" },
    { t: "空链表要跳过", body: "建堆时用 <code>if node</code> 过滤掉空链表。" },
    { t: "复杂度", body: "一共 n 个节点，每个进出堆一次，时间 O(n log k)，空间 O(k)。" },
  ],
};
