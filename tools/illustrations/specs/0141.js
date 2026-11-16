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
        slow = fast = head              #@init
        while fast and fast.next:       #@step
            slow = slow.next            #@step
            fast = fast.next.next       #@step
            if slow is fast:            #@step,meet
                return True             #@meet
        return False                    #@none
` }, { t: "简洁写法：集合记走过的节点（O(n) 空间）", key: "set", kind: "elegant", note: "同一个节点第二次出现就说明有环。好懂，但不满足进阶的 O(1) 空间。", code: `
class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        seen = set()                    #@init
        while head and head not in seen:  #@add,found,none
            seen.add(head)              #@add
            head = head.next            #@add
        return head is not None         #@found,none
` }],
  sig: { fn: "hasCycle", params: ["CycleList"], ret: "bool" },
  call: (a) => [[a.v, a.pos]],
  cases: [[[[1], -1]], [[[1, 2], 0]], [[[], -1]], [[[1], 0]], [[[1, 2, 3], 2]]],
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
  method: "快慢指针",
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
    snap("开始", "slow 和 fast 都从头节点出发。", view(false), { at: "init" });
    while (fast !== null && next[fast] !== null) {
      slow = next[slow]; fast = next[next[fast]];
      if (slow === fast) { snap("相遇", `slow 走一步到 ${v[slow]}，fast 走两步也到了 ${v[fast]}。两个指针<b>相遇</b>，说明有环。`, view(true), { at: ["step", "meet"], kind: "ok", ans: true }); return; }
      snap("各走一步", `slow 走一步到 ${v[slow]}，fast 走两步${fast === null ? "，走出了链表" : "到 " + v[fast]}。`, view(false), { at: "step" });
    }
    snap("没有环", "fast 或者它的下一个节点是空，说明链表有尽头，没有环。", view(false), { at: "none", kind: "warn", ans: false });
  },
  alts: [{
    t: "集合",
    code: "set",
    note: "和简洁写法一样：把走过的节点放进集合，同一个节点第二次出现就说明有环。好懂，但要 O(n) 额外空间。",
    legend: [["a", "当前节点"], ["e", "已经在 seen 里"], ["c", "第二次走到的节点"]],
    build(a, snap) {
      const v = a.v, n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : a.pos >= 0 ? a.pos : null)), seen = [];
      let h = n ? 0 : null;
      const view = (hit) => [
        { t: "list", label: "链表", nodes: v.map((x, i) => ({ v: x, cls: i === hit ? "c" : i === h ? "a" : seen.includes(i) ? "e" : "" })), next, ptrs: { head: h } },
        { t: "chips", label: "seen（存的是节点本身，这里写成 值#下标）", items: seen.map((i) => `${v[i]}#${i}`), empty: "空" },
      ];
      snap("开始", "从头节点出发，把走过的每个节点都放进集合 seen。", view(-1), { at: "init", facts: [["seen 大小", 0]] });
      while (h !== null && !seen.includes(h)) {
        seen.push(h);
        const cur = h; h = next[h];
        snap("记下", `${v[cur]}#${cur} 第一次走到，放进 seen，再走到${h === null ? "空" : ` ${v[h]}#${h}`}。`, view(-1), { at: "add", facts: [["seen 大小", seen.length]] });
      }
      if (h === null) snap("没有环", "走到了空，链表有尽头，没有环。", view(-1), { at: "none", kind: "warn", ans: false, facts: [["seen 大小", seen.length]] });
      else snap("有环", `${v[h]}#${h} 已经在 seen 里了：同一个节点第二次走到，说明有环。`, view(h), { at: "found", kind: "ok", ans: true, facts: [["seen 大小", seen.length]] });
    },
  }],
  points: [
    { t: "比较的是节点", body: "用 <code>is</code> 比较两个指针是不是同一个节点，不能比较值，值可能重复。" },
    { t: "先走再比", body: "两个指针一开始都在头节点，要先各走一次再判断是否相遇。" },
    { t: "复杂度", body: "时间 O(n)，空间 O(1)。" },
  ],
};
