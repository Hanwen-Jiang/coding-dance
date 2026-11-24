const F = require("../fig");

module.exports = {
  id: 206, name: "反转链表", title: "反转链表图解", level: "简单", topic: "链表",
  h1: "反转链表，一个个把箭头掉头",
  lede: "不用新建节点，也不用移动节点。从头走到尾，把每个节点的 next 指针改成指向它的前一个节点。难点只有一个：改之前要先记住下一个节点，否则后半段就找不到了。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "rev1ex1.jpg": [F.row([F.list([1, 2, 3, 4, 5]), F.list([5, 4, 3, 2, 1], { cls: () => "k" })], { label: "反转" })],
    "rev1ex2.jpg": [F.row([F.list([1, 2]), F.list([2, 1], { cls: () => "k" })], { label: "反转" })],
  },
  hints: [
    { t: "反转的其实是指针", body: ["<code>1 → 2 → 3</code> 变成 <code>1 ← 2 ← 3</code>，节点本身不动，只是每个箭头掉了头。"] },
    { t: "需要哪几个变量", body: ["<code>cur</code>：正在处理的节点。", "<code>prev</code>：它的前一个节点，也就是 <code>cur.next</code> 要改成的目标。一开始是 <code>None</code>，因为原来的头节点反转后是尾巴。"] },
    { t: "先存再改", body: ["把 <code>cur.next</code> 改成 <code>prev</code> 之后，原来的下一个节点就丢了。", "所以每一轮：先用 <code>nxt</code> 存下 <code>cur.next</code>，再改指针，然后 <code>prev</code>、<code>cur</code> 各往前走一步。"] },
  ],
  codes: [{ t: "标准解法：迭代", code: `
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev, cur = None, head          #@init
        while cur:
            nxt = cur.next              # 先记住下一个 #@save
            cur.next = prev             # 箭头掉头 #@flip
            prev = cur                  #@mprev
            cur = nxt                   #@mcur
        return prev                     #@done
` }, { t: "递归写法", key: "rec", note: "先让后面的部分反转好，再把自己接到它的尾巴上。", code: `
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if not head or not head.next:   #@base
            return head                 #@base
        new_head = self.reverseList(head.next)  #@down
        head.next.next = head           # 让后一个节点指回自己 #@back
        head.next = None                #@cut
        return new_head                 #@ret
` }, { t: "简洁写法：一行三连换", kind: "elegant", note: "右边先全部算好再赋值，所以三个指针可以一次挪完，不用临时变量。", code: `
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None
        while head:
            head.next, prev, head = prev, head, head.next
        return prev
` }],
  pytest: `
s = Solution()
assert toL(s.reverseList(L([1,2,3,4,5]))) == [5,4,3,2,1]
assert toL(s.reverseList(L([1,2]))) == [2,1]
assert toL(s.reverseList(L([]))) == []
`,
  sig: { fn: "reverseList", params: ["ListNode"], ret: "ListNode" },
  call: (a) => [a.v],
  cases: [[[]], [[7]]],
  method: "迭代",
  legend: [["a", "cur"], ["b", "prev"], ["k", "箭头已经掉头"]],
  presets: [
    { label: "示例 1", args: { v: [1, 2, 3, 4, 5] }, note: "head = [1,2,3,4,5]", expect: [5, 4, 3, 2, 1] },
    { label: "示例 2", args: { v: [1, 2] }, note: "head = [1,2]", expect: [2, 1] },
  ],
  build(a, snap) {
    const v = a.v, n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : null));
    let prev = null, cur = n ? 0 : null;
    const view = (opts = {}) => [{
      t: "list",
      label: "链表（虚红线 × 表示断开的旧指针，高亮弧线表示新掉头的指针）",
      nodes: v.map((x, i) => ({
        v: x,
        cls: i === cur ? "a" : i === prev ? "b" : prev !== null && i < prev ? "k" : "",
        ...(opts.hot === i ? { ecls: "on" } : {}),
      })),
      next: next.slice(),
      ptrs: { prev, cur, ...(opts.nxt !== undefined ? { nxt: opts.nxt } : {}) },
      ...(opts.ghostEdges ? { ghostEdges: opts.ghostEdges } : {}),
      ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
    }];
    if (!n) {
      snap("完成", "链表是空的，直接返回空。", [{ t: "note", label: "链表", html: "空" }], { at: "done", kind: "ok", ans: [] });
      return;
    }
    snap("prev, cur = None, head", `prev 一开始为空（原来的头节点 ${v[0]} 反转后是尾巴），cur 指向头节点 ${v[0]}。`, view(), { at: "init" });
    while (cur !== null) {
      const nxt = cur + 1 < n ? cur + 1 : null;
      snap(
        "nxt = cur.next",
        `先用 nxt 记住 ${v[cur]} 的下一个节点${nxt === null ? "（空）" : ` <b>${v[nxt]}</b>`}。下一行要改 ${v[cur]}.next，不先记住就找不到后面的链表了。`,
        view({ nxt }),
        { at: "save" },
      );
      next[cur] = prev;
      snap(
        "cur.next = prev",
        `把 ${v[cur]}.next 改成指向 prev（<b>${prev === null ? "空" : v[prev]}</b>）${nxt !== null ? `，断开原本指往 ${v[nxt]} 的箭头` : ""}。`,
        view({
          nxt,
          hot: cur,
          animEdges: [cur],
          ...(nxt !== null ? { ghostEdges: [[cur, nxt]] } : {}),
        }),
        { at: "flip" },
      );
      prev = cur;
      snap("prev = cur", `箭头已经掉头，把 prev 前移到刚处理完的 <b>${v[prev]}</b>。`, view({ nxt }), { at: "mprev" });
      cur = nxt;
      snap(
        "cur = nxt",
        cur === null ? "cur 沿着刚才存下的 nxt 走到空，循环结束。" : `cur 沿着刚才存下的 nxt 前移到 <b>${v[cur]}</b>，准备翻转下一个节点。`,
        view(),
        { at: "mcur" },
      );
    }
    snap("完成", `所有箭头都掉了头。返回 prev 指向的 <b>${v[prev]}</b>，就是新的头节点。`, view(), { at: "done", kind: "ok", ans: v.slice().reverse() });
  },
  alts: [{
    t: "递归",
    code: "rec",
    note: "和递归写法一样：先把 head 后面的部分反转好，再让 head 的下一个节点指回 head，head 自己指向空。",
    legend: [["a", "这一层的 head"], ["e", "在调用栈上，还没返回"], ["c", "new_head：反转后的头"], ["k", "已经反转好的部分"]],
    build(a, snap) {
      const v = a.v, n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : null)), calls = [];
      let nh = null;
      const view = (cur, opts = {}) => [
        {
          t: "list",
          label: "链表",
          nodes: v.map((x, i) => ({
            v: x,
            cls: i === cur ? "a" : i === nh ? "c" : calls.includes(i) ? "e" : nh !== null && i > cur ? "k" : "",
            ...(opts.hot === i ? { ecls: "on" } : {}),
          })),
          next: next.slice(),
          ptrs: { head: cur >= 0 ? cur : null, new_head: nh },
          ...(opts.ghostEdges ? { ghostEdges: opts.ghostEdges } : {}),
          ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
        },
        { t: "chips", label: "递归调用栈（右边是最里层）", items: calls.map((i) => ({ v: `reverseList(${v[i]})`, cls: i === cur ? "a" : "e" })), empty: "空" },
      ];
      if (!n) { snap("完成", "链表是空的，直接返回空。", [{ t: "note", label: "链表", html: "空" }], { at: "base", kind: "ok", ans: [] }); return; }
      for (let i = 0; i < n; i++) {
        calls.push(i);
        if (i === n - 1) {
          nh = i;
          snap("到底", `reverseList(${v[i]})：${v[i]} 后面没有节点了，它自己就是反转后的头 new_head，直接返回。`, view(i), { at: "base" });
          calls.pop();
        } else snap("往下递归", `reverseList(${v[i]})：先把 ${v[i]} 后面的部分反转好，再回来接 ${v[i]}。`, view(i), { at: "down" });
      }
      for (let i = n - 2; i >= 0; i--) {
        next[i + 1] = i;
        snap(
          "head.next.next = head",
          `回到 reverseList(${v[i]})，后面已经反转好了，新头是 ${v[nh]}。head.next 是 ${v[i + 1]}，让 <b>${v[i + 1]}.next 指回 ${v[i]}</b>。`,
          view(i, { hot: i + 1, animEdges: [i + 1] }),
          { at: "back" },
        );
        next[i] = null;
        snap(
          "head.next = None",
          `断开 ${v[i]} 原来指往 ${v[i + 1]} 的指针（置空），防止形成环。`,
          view(i, { ghostEdges: [[i, i + 1]] }),
          { at: "cut" },
        );
        snap(
          "return new_head",
          `把 new_head（<b>${v[nh]}</b>）原封不动返回给上一层。`,
          view(i),
          { at: "ret" },
        );
        calls.pop();
      }
      snap("完成", `递归全部返回，新的头节点是 <b>${v[nh]}</b>。`, view(-1), { at: "ret", kind: "ok", ans: v.slice().reverse() });
    },
  }],
  points: [
    { t: "返回 prev", body: "循环结束时 <code>cur</code> 是空，<code>prev</code> 才是新的头节点。" },
    { t: "prev 初始是 None", body: "原来的头节点反转后是尾节点，它的 next 应该是空。" },
    { t: "复杂度", body: "迭代：时间 O(n)，空间 O(1)。递归：空间 O(n)，是调用栈的深度。" },
  ],
};
