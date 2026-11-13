module.exports = {
  id: 206, name: "反转链表", title: "反转链表图解", level: "简单", topic: "链表",
  h1: "反转链表，一个个把箭头掉头",
  lede: "不用新建节点，也不用移动节点。从头走到尾，把每个节点的 next 指针改成指向它的前一个节点。难点只有一个：改之前要先记住下一个节点，否则后半段就找不到了。",
  hints: [
    { t: "反转的其实是指针", body: ["<code>1 → 2 → 3</code> 变成 <code>1 ← 2 ← 3</code>，节点本身不动，只是每个箭头掉了头。"] },
    { t: "需要哪几个变量", body: ["<code>cur</code>：正在处理的节点。", "<code>prev</code>：它的前一个节点，也就是 <code>cur.next</code> 要改成的目标。一开始是 <code>None</code>，因为原来的头节点反转后是尾巴。"] },
    { t: "先存再改", body: ["把 <code>cur.next</code> 改成 <code>prev</code> 之后，原来的下一个节点就丢了。", "所以每一轮：先用 <code>nxt</code> 存下 <code>cur.next</code>，再改指针，然后 <code>prev</code>、<code>cur</code> 各往前走一步。"] },
  ],
  codes: [{ t: "标准解法：迭代", code: `
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev, cur = None, head
        while cur:
            nxt = cur.next              # 先记住下一个
            cur.next = prev             # 箭头掉头
            prev, cur = cur, nxt        # 两个指针都往前走
        return prev
` }, { t: "递归写法", note: "先让后面的部分反转好，再把自己接到它的尾巴上。", code: `
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if not head or not head.next:
            return head
        new_head = self.reverseList(head.next)
        head.next.next = head           # 让后一个节点指回自己
        head.next = None
        return new_head
` }],
  pytest: `
s = Solution()
assert toL(s.reverseList(L([1,2,3,4,5]))) == [5,4,3,2,1]
assert toL(s.reverseList(L([1,2]))) == [2,1]
assert toL(s.reverseList(L([]))) == []
`,
  legend: [["a", "cur"], ["b", "prev"], ["k", "箭头已经掉头"]],
  presets: [
    { label: "示例 1", args: { v: [1, 2, 3, 4, 5] }, note: "head = [1,2,3,4,5]", expect: [5, 4, 3, 2, 1] },
    { label: "示例 2", args: { v: [1, 2] }, note: "head = [1,2]", expect: [2, 1] },
  ],
  build(a, snap) {
    const v = a.v, n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : null));
    let prev = null, cur = 0;
    const view = () => [{ t: "list", label: "链表", nodes: v.map((x, i) => ({ v: x, cls: i === cur ? "a" : i === prev ? "b" : prev !== null && i < prev ? "k" : "" })), next: next.slice(), ptrs: { prev, cur } }];
    snap("开始", "prev 是空，cur 在头节点。", view());
    while (cur !== null) {
      const nxt = cur + 1 < n ? cur + 1 : null;
      next[cur] = prev;
      snap("箭头掉头", `先记住 cur 的下一个节点${nxt === null ? "（空）" : " " + v[nxt]}。然后把 ${v[cur]} 的 next 改成指向 ${prev === null ? "空" : v[prev]}。`, view());
      prev = cur; cur = nxt;
      snap("往前走", cur === null ? "prev 移到刚处理完的节点，cur 走到了空，循环结束。" : `prev 移到 ${v[prev]}，cur 移到 ${v[cur]}。`, view());
    }
    snap("完成", `所有箭头都掉了头。prev 指着的 ${v[prev]} 就是新的头节点。`, view(), { kind: "ok", ans: v.slice().reverse() });
  },
  points: [
    { t: "返回 prev", body: "循环结束时 <code>cur</code> 是空，<code>prev</code> 才是新的头节点。" },
    { t: "prev 初始是 None", body: "原来的头节点反转后是尾节点，它的 next 应该是空。" },
    { t: "复杂度", body: "迭代：时间 O(n)，空间 O(1)。递归：空间 O(n)，是调用栈的深度。" },
  ],
};
