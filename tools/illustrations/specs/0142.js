module.exports = {
  id: 142, name: "环形链表 II", title: "环形链表 II 图解", level: "中等", topic: "链表",
  h1: "环形链表 II，相遇之后再从头走一遍",
  lede: "先用快慢指针找到相遇点。然后让一个指针回到头节点，两个指针都改成一次走一步，它们再次相遇的地方就是环的入口。",
  hints: [
    { t: "第一步和 141 一样", body: ["快慢指针相遇，说明有环。但相遇点一般不是入口。"] },
    { t: "算一下走了多远", body: ["设头节点到入口的距离是 <code>a</code>，入口到相遇点是 <code>b</code>，相遇点再走回入口是 <code>c</code>。", "相遇时 slow 走了 <code>a + b</code>，fast 走了它的两倍，同时 fast 比 slow 多绕了若干整圈。", "所以 <code>a + b</code> 等于若干整圈的长度，也就是 <code>a = c + 若干整圈</code>。"] },
    { t: "这个等式的意思", body: ["一个指针从头节点走 <code>a</code> 步到入口。另一个指针从相遇点走 <code>a</code> 步，等于走 <code>c</code> 步再绕几圈，也正好到入口。", "所以让它们同时出发、每次各走一步，会在入口相遇。"] },
  ],
  codes: [{ t: "标准解法：快慢指针，相遇后从头再走", code: `
class Solution:
    def detectCycle(self, head: Optional[ListNode]) -> Optional[ListNode]:
        slow = fast = head
        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next
            if slow is fast:            # 相遇，有环
                p = head
                while p is not slow:    # 两边各走一步，在入口相遇
                    p = p.next
                    slow = slow.next
                return p
        return None
` }],
  pytest: `
def mk(vals, pos):
    nodes = [ListNode(v) for v in vals]
    for a, b in zip(nodes, nodes[1:]): a.next = b
    if pos >= 0: nodes[-1].next = nodes[pos]
    return nodes
s = Solution()
for vals, pos in [([3,2,0,-4],1), ([1,2],0), ([1],-1), ([1,2,3,4,5,6,7],3), ([1],0), ([1,2,3,4,5,6,7,8,9],8)]:
    nodes = mk(vals, pos)
    assert s.detectCycle(nodes[0]) is (nodes[pos] if pos >= 0 else None)
`,
  legend: [["a", "slow"], ["b", "fast"], ["g", "从头出发的 p"], ["c", "环的入口"]],
  presets: [
    { label: "示例 1", args: { v: [3, 2, 0, -4], pos: 1 }, note: "head = [3,2,0,-4], pos = 1", expect: 1 },
    { label: "入口靠后", args: { v: [1, 2, 3, 4, 5, 6, 7], pos: 3 }, note: "head = [1,2,3,4,5,6,7], pos = 3", expect: 3 },
    { label: "没有环", args: { v: [1, 2, 3], pos: -1 }, note: "head = [1,2,3], pos = -1", expect: null },
  ],
  build(a, snap) {
    const v = a.v, n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : a.pos >= 0 ? a.pos : null));
    let slow = 0, fast = 0, p = null;
    const view = (entry) => [{ t: "list", label: "链表", nodes: v.map((x, i) => ({ v: x, cls: i === entry ? "c" : i === slow ? "a" : i === p ? "g" : i === fast ? "b" : "" })), next, ptrs: p === null ? { slow, fast } : { p, slow } }];
    snap("第一阶段", "slow 每次走一步，fast 每次走两步，先找到相遇点。", view());
    let met = false;
    while (fast !== null && next[fast] !== null) {
      slow = next[slow]; fast = next[next[fast]];
      if (slow === fast) { met = true; break; }
      snap("第一阶段", `slow 到 ${v[slow]}，fast ${fast === null ? "走出了链表" : "到 " + v[fast]}。`, view());
    }
    if (!met) { snap("没有环", "fast 走到了尽头，链表没有环，返回空。", view(), { kind: "warn", ans: null }); return; }
    snap("相遇", `slow 和 fast 在 ${v[slow]} 相遇，说明有环。但这里不一定是入口。`, view());
    fast = null; p = 0;
    snap("第二阶段", "让一个新指针 p 从头节点出发，slow 留在相遇点。接下来两个指针每次都只走一步。", view());
    while (p !== slow) {
      p = next[p]; slow = next[slow];
      if (p !== slow) snap("第二阶段", `p 走到 ${v[p]}，slow 走到 ${v[slow]}。`, view());
    }
    snap("找到入口", `p 和 slow 在 <b>${v[p]}</b> 相遇，这里就是环的入口（下标 ${p}）。`, view(p), { kind: "ok", ans: p });
  },
  points: [
    { t: "第二阶段都走一步", body: "相遇之后两个指针的速度要一样，都是每次一步。" },
    { t: "入口就是头节点时", body: "这时 a = 0，相遇点就是头节点，第二阶段的循环一次都不执行，直接返回。" },
    { t: "复杂度", body: "时间 O(n)，空间 O(1)。" },
  ],
};
