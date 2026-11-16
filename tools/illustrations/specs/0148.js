module.exports = {
  id: 148, name: "排序链表", title: "排序链表图解", level: "中等", topic: "链表",
  h1: "排序链表，对半拆到底再两两合并",
  lede: "链表不能按下标随机访问，快排和堆排都不好用，归并排序最合适：用快慢指针从中间断开，两半各自排好，再用「合并两个有序链表」把它们合起来。",
  hints: [
    { t: "为什么选归并", body: ["题目要求 <code>O(n log n)</code>。归并排序只需要顺序访问，而且合并两个有序链表不需要额外数组，很适合链表。"] },
    { t: "怎么从中间断开", body: ["快慢指针找中点：<code>slow</code> 走一步，<code>fast</code> 走两步。", "<code>fast</code> 到头时 <code>slow</code> 在前半段的最后一个节点，把 <code>slow.next</code> 置空，链表就断成了两半。"] },
    { t: "递归的三步", body: ["一、只有 0 或 1 个节点时已经有序，直接返回。", "二、断成两半，分别递归排序。", "三、把两个排好序的链表合并（21 题）。"] },
  ],
  codes: [{ t: "标准解法：自顶向下归并排序", code: `
class Solution:
    def sortList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if not head or not head.next:   #@base
            return head                 #@base
        slow, fast = head, head.next    # fast 先走一步，slow 停在前半段末尾 #@mid
        while fast and fast.next:       #@mid
            slow, fast = slow.next, fast.next.next  #@mid
        mid, slow.next = slow.next, None    # 从中间断开 #@cut
        left, right = self.sortList(head), self.sortList(mid)   #@rec
        dummy = cur = ListNode()        #@merge
        while left and right:           # 合并两个有序链表 #@merge
            if left.val <= right.val:   #@merge
                cur.next, left = left, left.next    #@merge
            else:
                cur.next, right = right, right.next #@merge
            cur = cur.next              #@merge
        cur.next = left or right        #@merge
        return dummy.next               #@merge,done
` }, { t: "简洁写法：取出值排序再写回", kind: "elegant", note: "实际运行最快，但用了 O(n) 额外空间，也没有考到链表操作，面试时只能当作开场。", code: `
class Solution:
    def sortList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        vals, node = [], head
        while node:
            vals.append(node.val)
            node = node.next
        node = head
        for v in sorted(vals):
            node.val = v
            node = node.next
        return head
` }],
  pytest: `
s = Solution()
assert toL(s.sortList(L([4,2,1,3]))) == [1,2,3,4]
assert toL(s.sortList(L([-1,5,3,4,0]))) == [-1,0,3,4,5]
assert toL(s.sortList(L([]))) == []
for _ in range(200):
    a = [random.randint(-9, 9) for _ in range(random.randint(0, 20))]
    assert toL(s.sortList(L(a))) == sorted(a)
`,
  sig: { fn: "sortList", params: ["ListNode"], ret: "ListNode" },
  call: (a) => [a.v],
  cases: [[[]], [[1]], [[2, 1]], [[5, -3, 5, 0, -100000, 100000, 7, 7, 1]]],
  legend: [["a", "正在拆开的一段"], ["e", "刚拆出的两半"], ["k", "刚合并好的一段"]],
  presets: [
    { label: "示例 1", args: { v: [4, 2, 1, 3] }, note: "head = [4,2,1,3]", expect: [1, 2, 3, 4] },
    { label: "示例 2", args: { v: [-1, 5, 3, 4, 0] }, note: "head = [-1,5,3,4,0]", expect: [-1, 0, 3, 4, 5] },
  ],
  build(a, snap) {
    const segs = [a.v.slice()]; let mark = {};
    const f = (s) => `[${s.join(", ")}]`;
    const view = () => [{ t: "chips", label: "当前的各段（从左到右是它们在链表里的顺序）", items: segs.map((s, i) => ({ v: f(s), cls: mark[i] || "" })) }];
    snap("开始", "整个链表是一段。超过一个节点的段都要继续拆。", view(), { at: "base" });
    const sort = (i) => {
      const s = segs[i];
      if (s.length <= 1) return;
      const h = Math.ceil(s.length / 2), L = s.slice(0, h), R = s.slice(h);
      mark = { [i]: "a" };
      snap("找中点", `${f(s)} 有 ${s.length} 个节点。快慢指针找到中点，准备从中间断开。`, view(), { at: "mid" });
      segs.splice(i, 1, L, R); mark = { [i]: "e", [i + 1]: "e" };
      snap("断开", `断成 ${f(L)} 和 ${f(R)}，两半分别去排序。`, view(), { at: ["cut", "rec"] });
      sort(i); sort(i + 1);
      const x = segs[i], y = segs[i + 1], m = []; let p = 0, q = 0;
      while (p < x.length && q < y.length) m.push(x[p] <= y[q] ? x[p++] : y[q++]);
      m.push(...x.slice(p), ...y.slice(q));
      mark = { [i]: "a", [i + 1]: "a" };
      snap("准备合并", `${f(x)} 和 ${f(y)} 都已经有序，用合并两个有序链表的方法合起来。`, view(), { at: "rec" });
      segs.splice(i, 2, m); mark = { [i]: "k" };
      snap("合并", `每次取两个头里较小的那个，得到 ${f(m)}。`, view(), { at: "merge" });
    };
    sort(0); mark = { 0: "k" };
    snap("完成", `所有段都合并回一条链表：${f(segs[0])}。`, view(), { at: "done", kind: "ok", ans: segs[0] });
  },
  points: [
    { t: "fast 从 head.next 出发", body: "这样两个节点的链表能断成 1 + 1。如果 fast 从 head 出发，会断成 2 + 0，递归永远不结束。" },
    { t: "一定要断开", body: "<code>slow.next = None</code> 不能少，否则左半段还连着右半段。" },
    { t: "复杂度", body: "时间 O(n log n)。递归栈深度 O(log n)。自底向上的写法可以做到 O(1) 空间。" },
  ],
};
