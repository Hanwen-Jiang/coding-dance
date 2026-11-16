const F = require("../fig");

module.exports = {
  id: 19, name: "删除链表的倒数第 N 个结点", title: "删除倒数第 N 个结点图解", level: "中等", topic: "链表",
  h1: "删除倒数第 N 个结点，让两个指针保持固定的距离",
  lede: "链表不知道长度，也不能倒着走。让 fast 先走 n 步，然后 fast 和 slow 一起走。fast 走到最后一个节点时，slow 正好停在要删除的节点前面。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "remove_ex1.jpg": [F.row([F.list([1, 2, 3, 4, 5], { cls: (v, i) => (i === 3 ? "w" : "") }), F.list([1, 2, 3, 5])], { label: "删掉倒数第 2 个节点（4）" })],
  },
  hints: [
    { t: "最直接的做法", body: ["先走一遍数出长度 <code>L</code>，倒数第 n 个就是正数第 <code>L − n + 1</code> 个，再走一遍去删。需要走两遍。"] },
    { t: "一遍怎么做", body: ["让 <code>fast</code> 比 <code>slow</code> 领先 n 步，然后同时走。", "<code>fast</code> 到最后一个节点时，<code>slow</code> 后面正好还有 n 个节点，也就是 <code>slow.next</code> 是倒数第 n 个。"] },
    { t: "为什么需要哑节点", body: ["删除一个节点要改的是它<strong>前一个</strong>节点的指针。", "如果要删的是头节点，它没有前一个节点。在头节点前面加一个 <code>dummy</code>，所有情况就都一样了。"] },
  ],
  codes: [{ t: "标准解法：哑节点 + 快慢指针", code: `
class Solution:
    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)       #@init
        slow = fast = dummy             #@init
        for _ in range(n):              # fast 先走 n 步 #@ahead
            fast = fast.next            #@ahead
        while fast.next:                # 一起走，直到 fast 在最后一个节点 #@loop
            slow = slow.next            #@walk
            fast = fast.next            #@walk
        slow.next = slow.next.next      # 跳过要删的节点 #@del
        return dummy.next               #@done
` }, { t: "简洁写法：递归数倒数第几个", key: "rec", kind: "elegant", note: "递归返回时自然是从尾往头，返回值就是「倒数第几个」。数到倒数第 n + 1 个时，删掉它后面那个。", code: `
class Solution:
    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        def rec(node):
            if not node:                #@base
                return 0                #@base
            k = rec(node.next) + 1      #@down,count
            if k == n + 1:              #@del
                node.next = node.next.next  #@del
            return k                    #@ret
        dummy = ListNode(0, head)       #@start
        rec(dummy)                      #@start
        return dummy.next               #@done
` }],
  pytest: `
s = Solution()
assert toL(s.removeNthFromEnd(L([1,2,3,4,5]), 2)) == [1,2,3,5]
assert toL(s.removeNthFromEnd(L([1]), 1)) == []
assert toL(s.removeNthFromEnd(L([1,2]), 1)) == [1]
assert toL(s.removeNthFromEnd(L([1,2]), 2)) == [2]
`,
  sig: { fn: "removeNthFromEnd", params: ["ListNode", "int"], ret: "ListNode" },
  call: (a) => [a.v, a.n],
  cases: [[[1], 1], [[1, 2], 1], [[1, 2], 2]],
  method: "快慢指针",
  legend: [["a", "slow"], ["b", "fast"], ["w", "要删除的节点"], ["d", "哑节点 / 已删除"]],
  presets: [
    { label: "示例 1", args: { v: [1, 2, 3, 4, 5], n: 2 }, note: "head = [1,2,3,4,5], n = 2", expect: [1, 2, 3, 5] },
    { label: "删的是头节点", args: { v: [1, 2, 3], n: 3 }, note: "head = [1,2,3], n = 3", expect: [2, 3] },
  ],
  build(a, snap) {
    const v = ["D", ...a.v], len = v.length, n = a.n, next = v.map((_, i) => (i + 1 < len ? i + 1 : null));
    let slow = 0, fast = 0, del = -1, gone = false;
    const view = () => [{ t: "list", label: "链表（D 是哑节点）", nodes: v.map((x, i) => ({ v: x, cls: i === del ? (gone ? "d" : "w") : i === slow ? "a" : i === fast ? "b" : i === 0 ? "d" : "" })), next: next.slice(), ptrs: { slow, fast } }];
    snap("开始", `在头节点前面加一个哑节点 D。slow 和 fast 都从 D 出发，要删的是倒数第 ${n} 个。`, view(), { at: "init" });
    for (let t = 0; t < n; t++) { fast++; snap("fast 先走", `fast 先走第 ${t + 1} 步，到 ${v[fast]}。`, view(), { at: "ahead" }); }
    snap("拉开距离", `fast 领先 slow 正好 ${n} 步。接下来两个指针一起走。`, view(), { at: "loop" });
    while (next[fast] !== null) { slow++; fast++; snap("一起走", `slow 到 ${v[slow]}，fast 到 ${v[fast]}。`, view(), { at: "walk" }); }
    del = slow + 1;
    snap("找到位置", `fast 到了最后一个节点。slow 的下一个节点 <b>${v[del]}</b> 就是倒数第 ${n} 个。`, view(), { at: "loop" });
    next[slow] = del + 1 < len ? del + 1 : null; gone = true;
    snap("删除", `把 slow 的 next 指向 ${v[del]} 的下一个节点${next[slow] === null ? "（空）" : " " + v[next[slow]]}，${v[del]} 就从链表里脱离了。`, view(), { at: "del" });
    const ans = a.v.filter((_, i) => i + 1 !== del);
    snap("完成", `返回 dummy.next，结果是 [${ans.join(", ")}]。`, view(), { at: "done", kind: "ok", ans });
  },
  alts: [{
    t: "递归数位置",
    code: "rec",
    note: "和简洁写法一样：递归一路走到空，返回时从尾往头数，返回值就是「倒数第几个」。数到 n + 1 的那个节点，删掉它后面那个。",
    legend: [["a", "正在执行的这一层"], ["e", "在调用栈上，还没返回"], ["d", "哑节点 / 已删除"]],
    build(a, snap) {
      const v = ["D", ...a.v], len = v.length, n = a.n, next = v.map((_, i) => (i + 1 < len ? i + 1 : null));
      const k = {}, calls = []; let del = -1;
      const view = (cur) => [
        { t: "list", label: "链表（D 是哑节点；下面写的是倒数第几个）", nodes: v.map((x, i) => ({ v: x, cls: i === del ? "d" : i === cur ? "a" : calls.includes(i) ? "e" : i === 0 ? "d" : "" })), next: next.slice(), ptrs: Object.fromEntries(Object.entries(k).map(([i, x]) => [`k=${x}`, +i])) },
        { t: "chips", label: "递归调用栈（右边是最里层）", items: calls.map((i) => ({ v: `rec(${v[i]})`, cls: i === cur ? "a" : "e" })), empty: "空" },
      ];
      snap("开始", `从哑节点 D 开始递归。要删的是倒数第 ${n} 个，所以要找倒数第 ${n + 1} 个，也就是它前面那个节点。`, view(-1), { at: "start" });
      for (let i = 0; i < len; i++) {
        calls.push(i);
        snap("往下递归", `调用 rec(${v[i]})。它要先等 rec(${i + 1 < len ? v[i + 1] : "空"}) 返回，才知道自己是倒数第几个。`, view(i), { at: "down" });
      }
      snap("到底", "rec(空) 直接返回 0：空节点后面没有节点。开始往回返回。", view(-1), { at: "base" });
      for (let i = len - 1; i >= 0; i--) {
        k[i] = len - i;
        if (k[i] === n + 1) {
          del = i + 1; next[i] = del + 1 < len ? del + 1 : null;
          snap("删除", `rec(${v[i]}) 得到 ${k[i] - 1} + 1 = <b>${k[i]}</b>，正好是 n + 1：${v[i]} 是要删节点的前一个。把 ${v[i]}.next 改成指向${next[i] === null ? "空" : " " + v[next[i]]}，倒数第 ${n} 个 ${v[del]} 被删掉。`, view(i), { at: ["count", "del"], kind: "warn" });
        } else snap("返回", `rec(${v[i]}) 拿到后面返回的 ${k[i] - 1}，加 1 得 ${k[i]}：${i === 0 ? "哑节点 D 也算一个" : `${v[i]} 是倒数第 ${k[i]} 个`}。`, view(i), { at: ["count", "ret"] });
        calls.pop();
      }
      const ans = a.v.filter((_, i) => i + 1 !== del);
      snap("完成", `递归全部返回。dummy.next 开始的链表就是结果：[${ans.join(", ")}]。`, view(-1), { at: "done", kind: "ok", ans });
    },
  }],
  points: [
    { t: "slow 从 dummy 出发", body: "这样 slow 最后停在要删节点的<strong>前一个</strong>，才能改指针。" },
    { t: "循环条件是 fast.next", body: "让 fast 停在最后一个节点，而不是走到空，否则 slow 会多走一步。" },
    { t: "复杂度", body: "只遍历一遍，时间 O(n)，空间 O(1)。" },
  ],
};
