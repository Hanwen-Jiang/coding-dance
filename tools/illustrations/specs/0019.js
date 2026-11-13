module.exports = {
  id: 19, name: "删除链表的倒数第 N 个结点", title: "删除倒数第 N 个结点图解", level: "中等", topic: "链表",
  h1: "删除倒数第 N 个结点，让两个指针保持固定的距离",
  lede: "链表不知道长度，也不能倒着走。让 fast 先走 n 步，然后 fast 和 slow 一起走。fast 走到最后一个节点时，slow 正好停在要删除的节点前面。",
  hints: [
    { t: "最直接的做法", body: ["先走一遍数出长度 <code>L</code>，倒数第 n 个就是正数第 <code>L − n + 1</code> 个，再走一遍去删。需要走两遍。"] },
    { t: "一遍怎么做", body: ["让 <code>fast</code> 比 <code>slow</code> 领先 n 步，然后同时走。", "<code>fast</code> 到最后一个节点时，<code>slow</code> 后面正好还有 n 个节点，也就是 <code>slow.next</code> 是倒数第 n 个。"] },
    { t: "为什么需要哑节点", body: ["删除一个节点要改的是它<strong>前一个</strong>节点的指针。", "如果要删的是头节点，它没有前一个节点。在头节点前面加一个 <code>dummy</code>，所有情况就都一样了。"] },
  ],
  codes: [{ t: "标准解法：哑节点 + 快慢指针", code: `
class Solution:
    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        slow = fast = dummy
        for _ in range(n):              # fast 先走 n 步
            fast = fast.next
        while fast.next:                # 一起走，直到 fast 在最后一个节点
            slow = slow.next
            fast = fast.next
        slow.next = slow.next.next      # 跳过要删的节点
        return dummy.next
` }],
  pytest: `
s = Solution()
assert toL(s.removeNthFromEnd(L([1,2,3,4,5]), 2)) == [1,2,3,5]
assert toL(s.removeNthFromEnd(L([1]), 1)) == []
assert toL(s.removeNthFromEnd(L([1,2]), 1)) == [1]
assert toL(s.removeNthFromEnd(L([1,2]), 2)) == [2]
`,
  legend: [["a", "slow"], ["b", "fast"], ["w", "要删除的节点"], ["d", "哑节点 / 已删除"]],
  presets: [
    { label: "示例 1", args: { v: [1, 2, 3, 4, 5], n: 2 }, note: "head = [1,2,3,4,5], n = 2", expect: [1, 2, 3, 5] },
    { label: "删的是头节点", args: { v: [1, 2, 3], n: 3 }, note: "head = [1,2,3], n = 3", expect: [2, 3] },
  ],
  build(a, snap) {
    const v = ["D", ...a.v], len = v.length, n = a.n, next = v.map((_, i) => (i + 1 < len ? i + 1 : null));
    let slow = 0, fast = 0, del = -1, gone = false;
    const view = () => [{ t: "list", label: "链表（D 是哑节点）", nodes: v.map((x, i) => ({ v: x, cls: i === del ? (gone ? "d" : "w") : i === slow ? "a" : i === fast ? "b" : i === 0 ? "d" : "" })), next: next.slice(), ptrs: { slow, fast } }];
    snap("开始", `在头节点前面加一个哑节点 D。slow 和 fast 都从 D 出发，要删的是倒数第 ${n} 个。`, view());
    for (let t = 0; t < n; t++) { fast++; snap("fast 先走", `fast 先走第 ${t + 1} 步，到 ${v[fast]}。`, view()); }
    snap("拉开距离", `fast 领先 slow 正好 ${n} 步。接下来两个指针一起走。`, view());
    while (next[fast] !== null) { slow++; fast++; snap("一起走", `slow 到 ${v[slow]}，fast 到 ${v[fast]}。`, view()); }
    del = slow + 1;
    snap("找到位置", `fast 到了最后一个节点。slow 的下一个节点 <b>${v[del]}</b> 就是倒数第 ${n} 个。`, view());
    next[slow] = del + 1 < len ? del + 1 : null; gone = true;
    snap("删除", `把 slow 的 next 指向 ${v[del]} 的下一个节点${next[slow] === null ? "（空）" : " " + v[next[slow]]}，${v[del]} 就从链表里脱离了。`, view());
    const ans = a.v.filter((_, i) => i + 1 !== del);
    snap("完成", `返回 dummy.next，结果是 [${ans.join(", ")}]。`, view(), { kind: "ok", ans });
  },
  points: [
    { t: "slow 从 dummy 出发", body: "这样 slow 最后停在要删节点的<strong>前一个</strong>，才能改指针。" },
    { t: "循环条件是 fast.next", body: "让 fast 停在最后一个节点，而不是走到空，否则 slow 会多走一步。" },
    { t: "复杂度", body: "只遍历一遍，时间 O(n)，空间 O(1)。" },
  ],
};
