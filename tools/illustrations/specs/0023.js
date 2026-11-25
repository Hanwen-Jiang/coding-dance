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
        heap = [(node.val, i, node) for i, node in enumerate(lists) if node]   #@build
        heapq.heapify(heap)             #@build
        dummy = cur = ListNode()        #@build
        while heap:
            val, i, node = heapq.heappop(heap)  #@pop
            cur.next = node             #@pop
            cur = node                  #@pop
            if node.next:               #@push,end
                heapq.heappush(heap, (node.next.val, i, node.next))    #@push
        return dummy.next               #@done
` }, { t: "另一种写法：分治，两两合并", key: "dc", note: "每一轮把相邻的两个链表合并成一个，链表个数减半，直到只剩一个。复杂度同样是 O(n log k)。", code: `
class Solution:
    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:
        def merge2(a, b):               # 合并两个有序链表
            dummy = cur = ListNode()    #@merge
            while a and b:              #@merge
                if a.val <= b.val:      #@merge
                    cur.next, a = a, a.next     #@merge
                else:                   #@merge
                    cur.next, b = b, b.next     #@merge
                cur = cur.next          #@merge
            cur.next = a or b           #@merge,single
            return dummy.next           #@merge,single

        if not lists:                   #@empty
            return None                 #@empty
        while len(lists) > 1:           # 每一轮个数减半 #@round
            lists = [merge2(lists[i], lists[i + 1] if i + 1 < len(lists) else None)   #@merge,single
                     for i in range(0, len(lists), 2)]  #@merge,single
        return lists[0]                 #@done
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
  sig: { fn: "mergeKLists", params: ["ListNode[]"], ret: "ListNode" },
  call: (a) => [a.ls],
  cases: [[[]], [[[]]], [[[], [1]]], [[[2], [1]]], [[[-2, 0, 3], [], [-2, -1], [5]]]],
  method: "小顶堆",
  legend: [["a", "当前头节点"], ["d", "已经接走 / 哑节点"], ["e", "小顶堆堆顶"], ["c", "刚弹出 / 刚补入 / 刚接上"], ["k", "结果链表"]],
  presets: [
    { label: "示例 1", args: { ls: [[1, 4, 5], [1, 3, 4], [2, 6]] }, note: "lists = [[1,4,5],[1,3,4],[2,6]]", expect: [1, 1, 2, 3, 4, 4, 5, 6] },
    { label: "四个链表", args: { ls: [[3, 9], [1, 7, 8], [2], [4, 5, 6]] }, note: "lists = [[3,9],[1,7,8],[2],[4,5,6]]", expect: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
  build(a, snap) {
    const ls = a.ls, pos = ls.map(() => 0), out = [];
    let heap = [], popped = null, curIdx = 0;
    const sortHeap = () => heap.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const view = (opts = {}) => [
      ...ls.map((l, i) => ({
        t: "chips",
        label: `链表 ${i}`,
        items: l.map((v, j) => ({ v, cls: j < pos[i] ? "d" : j === pos[i] ? (popped === i ? "c" : "a") : "" })),
        empty: "空",
      })),
      {
        t: "chips",
        label: "小顶堆（按值排好，最左边是堆顶；写的是 值 @ 链表编号）",
        items: heap.map(([v, i], t) => ({
          v: `${v} @${i}`,
          cls: opts.pushed === i ? "c" : t === 0 ? "e" : "",
        })),
        empty: "空",
      },
      {
        t: "list",
        label: "结果链表（D 是哑节点，高亮箭头表示刚接上的节点）",
        nodes: [
          { v: "D", cls: "d", ...(opts.hot === 0 ? { ecls: "on" } : {}) },
          ...out.map((v, idx) => ({
            v,
            cls: opts.newNode === idx + 1 ? "c" : "k",
            ...(opts.newNode === idx + 1 ? { prev: "" } : {}),
            ...(opts.hot === idx + 1 ? { ecls: "on" } : {}),
          })),
        ],
        next: Array.from({ length: out.length + 1 }, (_, k) => (k + 1 <= out.length ? k + 1 : null)),
        showNil: !!opts.done,
        ptrs: { dummy: 0, cur: curIdx },
        ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
      },
    ];
    ls.forEach((l, i) => { if (l.length) heap.push([l[0], i]); });
    sortHeap();
    snap(
      "建堆",
      `把 ${ls.length} 个链表里的非空头节点都放进小顶堆（共 ${heap.length} 个），并建好哑节点 D。`,
      view(),
      { at: "build", facts: [["堆大小", heap.length], ["已合并", 0]] },
    );
    while (heap.length) {
      const prevHeapLen = heap.length;
      const [v, i] = heap.shift();
      popped = i;
      snap(
        "弹出最小值",
        `堆顶是 <b>${v}</b>（来自链表 ${i}），它是当前所有头节点里最小的，先从堆里弹出来。`,
        view(),
        { at: "pop", facts: [["堆大小", heap.length, prevHeapLen], ["弹出", `${v} (@${i})`], ["已合并", out.length]] },
      );
      const prevOutLen = out.length;
      out.push(v);
      pos[i]++;
      popped = null;
      snap(
        "接到 cur.next",
        `把弹出的 <b>${v}</b> 接到 cur.next 后面，并让 cur 前进到它。`,
        view({ newNode: out.length, hot: curIdx, animEdges: [curIdx] }),
        { at: "pop", facts: [["堆大小", heap.length], ["已合并", out.length, prevOutLen]] },
      );
      curIdx = out.length;
      const nx = ls[i][pos[i]];
      if (nx !== undefined) {
        const beforePush = heap.length;
        heap.push([nx, i]);
        sortHeap();
        snap(
          "补进下一个",
          `链表 ${i} 后面还有节点 <b>${nx}</b>，把它放进小顶堆，作为链表 ${i} 新的头。`,
          view({ pushed: i }),
          { at: "push", facts: [["堆大小", heap.length, beforePush], ["补入堆", `${nx} (@${i})`], ["已合并", out.length]] },
        );
      } else {
        snap(
          "这个链表走完了",
          `链表 ${i} 后面没有节点了，不用补进堆。堆里还剩 ${heap.length} 个。`,
          view(),
          { at: "end", kind: "warn", facts: [["堆大小", heap.length], ["已合并", out.length]] },
        );
      }
    }
    snap("完成", `堆空了，所有节点都接好了：[${out.join(", ")}]。`, view({ done: true }), { at: "done", kind: "ok", ans: out.slice(), facts: [["堆大小", 0], ["已合并", out.length]] });
  },
  alts: [{
    t: "分治两两合并",
    code: "dc",
    note: "和「另一种写法」一样：每一轮把相邻的两个链表合并成一个（就是「合并两个有序链表」），链表个数减半，直到只剩一个。",
    legend: [["a", "正在合并的两个"], ["d", "这一轮已经合并过"], ["c", "刚合并出来的"]],
    build(a, snap) {
      let ls = a.ls.map((l) => l.slice()), round = 0;
      const merge2 = (p, q) => {
        const r = [];
        let i = 0, j = 0;
        while (i < p.length && j < q.length) r.push(p[i] <= q[j] ? p[i++] : q[j++]);
        return r.concat(p.slice(i), q.slice(j));
      };
      const view = (hl, doneBefore, nx, hiNew) => [
        ...ls.map((l, i) => ({
          t: "chips",
          label: `${nx ? "这一轮 · " : ""}链表 ${i}`,
          items: l.map((v) => ({ v, cls: hl.includes(i) ? "a" : nx && i < doneBefore ? "d" : "" })),
          empty: "空",
        })),
        ...(nx || []).map((l, t) => ({
          t: "chips",
          label: `下一轮 · 链表 ${t}`,
          items: l.map((v) => ({ v, cls: hiNew && t === nx.length - 1 ? "c" : "" })),
          empty: "空",
        })),
      ];
      if (!ls.length) {
        snap("完成", "没有链表，直接返回空。", [{ t: "note", label: "lists", html: "空" }], { at: "empty", kind: "ok", ans: [], facts: [["链表数", 0]] });
        return;
      }
      snap("开始", `一共 ${ls.length} 个链表。每一轮把相邻的两个合并成一个，个数减半。`, view([], 0, null, false), { at: "round", facts: [["轮次", 0], ["链表数", ls.length]] });
      while (ls.length > 1) {
        round++;
        const prevCount = ls.length;
        const nx = [];
        for (let i = 0; i < ls.length; i += 2) {
          if (i + 1 < ls.length) {
            snap(
              `第 ${round} 轮 · 选中一对`,
              `准备合并链表 ${i}（[${ls[i].join(", ")}]）和链表 ${i + 1}（[${ls[i + 1].join(", ")}]）。`,
              view([i, i + 1], i, nx, false),
              { at: "merge", facts: [["轮次", round], ["正在合并", `链表 ${i} + ${i + 1}`], ["下轮已生成", nx.length]] },
            );
            const merged = merge2(ls[i], ls[i + 1]);
            nx.push(merged);
            snap(
              `第 ${round} 轮 · 合并完成`,
              `两个头依次比大小，小的先接上，得到 [${merged.join(", ")}]。`,
              view([], i + 2, nx, true),
              { at: "merge", facts: [["轮次", round], ["下轮已生成", nx.length, nx.length - 1]] },
            );
          } else {
            nx.push(ls[i].slice());
            snap(
              `第 ${round} 轮 · 落单直通`,
              `链表 ${i} 落单了，和空链表合并等于它自己，原样进入下一轮。`,
              view([i], i, nx, true),
              { at: "single", facts: [["轮次", round], ["下轮已生成", nx.length, nx.length - 1]] },
            );
          }
        }
        ls = nx.map((l) => l.slice());
        snap(
          `第 ${round} 轮完`,
          ls.length > 1 ? `还剩 ${ls.length} 个链表，继续下一轮。` : "只剩一个链表了。",
          view([], 0, null, false),
          { at: "round", facts: [["轮次", round], ["剩余链表数", ls.length, prevCount]] },
        );
      }
      snap(
        "完成",
        `合并完成：[${ls[0].join(", ")}]。一共 ${round} 轮，每轮每个节点只被处理一次，所以是 O(n log k)。`,
        view([], 0, null, false),
        { at: "done", kind: "ok", ans: ls[0].slice(), facts: [["总轮次", round], ["最终长度", ls[0].length]] },
      );
    },
  }],
  points: [
    { t: "堆里要放编号", body: "值相等时 Python 会接着比较元组的下一项。<code>ListNode</code> 不能比较大小，所以中间放一个链表编号。" },
    { t: "空链表要跳过", body: "建堆时用 <code>if node</code> 过滤掉空链表。" },
    { t: "复杂度", body: "一共 n 个节点，每个进出堆一次，时间 O(n log k)，空间 O(k)。" },
  ],
};
