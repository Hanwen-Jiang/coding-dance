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
  points: [
    { t: "堆里要放编号", body: "值相等时 Python 会接着比较元组的下一项。<code>ListNode</code> 不能比较大小，所以中间放一个链表编号。" },
    { t: "空链表要跳过", body: "建堆时用 <code>if node</code> 过滤掉空链表。" },
    { t: "复杂度", body: "一共 n 个节点，每个进出堆一次，时间 O(n log k)，空间 O(k)。" },
  ],
};
