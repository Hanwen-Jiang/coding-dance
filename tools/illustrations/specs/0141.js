module.exports = {
  id: 141, name: "环形链表", title: "环形链表图解", level: "简单", topic: "链表",
  h1: "环形链表，跑得快的会追上跑得慢的",
  lede: "两个人在操场上跑步，一个快一个慢。如果跑道是直的，快的先到终点；如果跑道是环形的，快的迟早会从后面追上慢的。用快慢两个指针走链表，是同一个道理。",
  hints: [
    { t: "最直接的做法", body: ["用一个集合记录走过的节点，再次遇到同一个节点就说明有环。空间 <code>O(n)</code>。"] },
    { t: "不用额外空间", body: ["<code>slow</code> 每次走一步，<code>fast</code> 每次走两步。", "没有环：<code>fast</code> 会先走到空。有环：两个指针都会进到环里，<code>fast</code> 每一步比 <code>slow</code> 多走一格，距离每次缩小 1，一定会相遇。"] },
    { t: "循环条件", body: ["<code>fast</code> 要走两步，所以要保证 <code>fast</code> 和 <code>fast.next</code> 都不为空。", "任何一个为空，说明走到了尽头，没有环。"] },
  ],
  codes: [{ t: "标准解法：快慢指针", code: `
class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        slow = fast = head
        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next
            if slow is fast:
                return True
        return False
` }],
  pytest: `
def mk(vals, pos):
    nodes = [ListNode(v) for v in vals]
    for a, b in zip(nodes, nodes[1:]): a.next = b
    if pos >= 0: nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None
s = Solution()
assert s.hasCycle(mk([3,2,0,-4], 1)) is True
assert s.hasCycle(mk([1,2], 0)) is True
assert s.hasCycle(mk([1], -1)) is False
assert s.hasCycle(mk([1,2,3,4], -1)) is False
assert s.hasCycle(mk([], -1)) is False
`,
  legend: [["a", "slow"], ["b", "fast"], ["c", "相遇"]],
  presets: [
    { label: "示例 1", args: { v: [3, 2, 0, -4], pos: 1 }, note: "head = [3,2,0,-4], pos = 1", expect: true },
    { label: "环更大", args: { v: [1, 2, 3, 4, 5, 6, 7], pos: 2 }, note: "head = [1,2,3,4,5,6,7], pos = 2", expect: true },
    { label: "没有环", args: { v: [1, 2, 3, 4, 5], pos: -1 }, note: "head = [1,2,3,4,5], pos = -1", expect: false },
  ],
  build(a, snap) {
    const v = a.v, n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : a.pos >= 0 ? a.pos : null));
    let slow = 0, fast = 0;
    const view = (met) => [{ t: "list", label: "链表", nodes: v.map((x, i) => ({ v: x, cls: met && i === slow ? "c" : i === slow ? "a" : i === fast ? "b" : "" })), next, ptrs: { slow, fast } }];
    snap("开始", "slow 和 fast 都从头节点出发。", view(false));
    while (fast !== null && next[fast] !== null) {
      slow = next[slow]; fast = next[next[fast]];
      if (slow === fast) { snap("相遇", `slow 走一步到 ${v[slow]}，fast 走两步也到了 ${v[fast]}。两个指针<b>相遇</b>，说明有环。`, view(true), { kind: "ok", ans: true }); return; }
      snap("各走一步", `slow 走一步到 ${v[slow]}，fast 走两步${fast === null ? "，走出了链表" : "到 " + v[fast]}。`, view(false));
    }
    snap("没有环", "fast 或者它的下一个节点是空，说明链表有尽头，没有环。", view(false), { kind: "warn", ans: false });
  },
  points: [
    { t: "比较的是节点", body: "用 <code>is</code> 比较两个指针是不是同一个节点，不能比较值，值可能重复。" },
    { t: "先走再比", body: "两个指针一开始都在头节点，要先各走一次再判断是否相遇。" },
    { t: "复杂度", body: "时间 O(n)，空间 O(1)。" },
  ],
};
