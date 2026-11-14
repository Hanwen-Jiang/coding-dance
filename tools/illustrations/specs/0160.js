module.exports = {
  id: 160, name: "相交链表", title: "相交链表图解", level: "简单", topic: "链表",
  h1: "相交链表，走完自己的路再走对方的路",
  lede: "两个链表长度不同，所以两个指针同时出发不会同时到达交点。让每个指针走完自己的链表后，接着从对方的头开始走。这样两个指针走的总长度相同，会同时到达交点。",
  hints: [
    { t: "为什么直接走不行", body: ["如果两个链表在交点之前的长度一样，两个指针同时走就会同时到交点。", "问题是前面的长度可能不同，要想办法把这个差距抹掉。"] },
    { t: "把两段路拼起来", body: ["设 A 独有的部分长 <code>a</code>，B 独有的部分长 <code>b</code>，公共部分长 <code>c</code>。", "指针 pa 走 A 再走 B：<code>a + c + b</code> 步到交点。指针 pb 走 B 再走 A：<code>b + c + a</code> 步到交点。两者相等。"] },
    { t: "不相交的情况", body: ["没有交点时，两个指针都走了 <code>(a + c) + (b + c)</code> 步后同时变成空，循环也会结束，返回空。", "所以走到末尾时要走到空再换链表，不能在最后一个节点就换。"] },
  ],
  codes: [{ t: "标准解法：双指针换路", code: `
class Solution:
    def getIntersectionNode(self, headA: ListNode, headB: ListNode) -> Optional[ListNode]:
        pa, pb = headA, headB
        while pa is not pb:
            pa = pa.next if pa else headB   # 走到空就换到 B 的头
            pb = pb.next if pb else headA
        return pa                       # 交点，或者都是空
` }, { t: "简洁写法：集合（O(m+n) 空间）", kind: "elegant", note: "把 A 的节点都放进集合，B 上第一个在集合里的节点就是交点。比较的是节点本身，不是值。", code: `
class Solution:
    def getIntersectionNode(self, headA: ListNode, headB: ListNode) -> Optional[ListNode]:
        seen = set()
        while headA:
            seen.add(headA)
            headA = headA.next
        while headB and headB not in seen:
            headB = headB.next
        return headB
` }],
  pytest: `
def mk(xa, xb, common):
    c = L(common)
    def pre(vals):
        d = cur = ListNode()
        for v in vals: cur.next = ListNode(v); cur = cur.next
        cur.next = c
        return d.next
    return pre(xa), pre(xb), c
s = Solution()
for xa, xb, cm in [([4,1],[5,6,1],[8,4,5]), ([1,9,1],[3],[2,4]), ([2,6,4],[1,5],[]), ([],[],[1]), ([1],[],[2,3])]:
    A, B, c = mk(xa, xb, cm)
    assert s.getIntersectionNode(A, B) is c
`,
  method: "双指针换路",
  legend: [["a", "pa"], ["b", "pb"], ["g", "公共部分"], ["c", "相遇的交点"]],
  presets: [
    { label: "示例 1", args: { xa: [4, 1], xb: [5, 6, 1], cm: [8, 4, 5] }, note: "A = [4,1,8,4,5], B = [5,6,1,8,4,5]，从 8 开始相交", expect: 8 },
    { label: "不相交", args: { xa: [2, 6, 4], xb: [1, 5], cm: [] }, note: "A = [2,6,4], B = [1,5]，不相交", expect: null },
  ],
  build(a, snap) {
    const { xa, xb, cm } = a, A = xa.length, B = xb.length, C = cm.length;
    // 位置编码：["A", i] A 独有部分；["B", i]；["C", i] 公共部分；null 表示空
    let pa = A ? ["A", 0] : C ? ["C", 0] : null, pb = B ? ["B", 0] : C ? ["C", 0] : null, onB = false, onA = false, met = false;
    const headOf = (w) => (w === "A" ? (A ? ["A", 0] : C ? ["C", 0] : null) : B ? ["B", 0] : C ? ["C", 0] : null);
    const step = (p) => { const [w, i] = p; const len = w === "A" ? A : w === "B" ? B : C; if (i + 1 < len) return [w, i + 1]; return w === "C" ? null : C ? ["C", 0] : null; };
    const at = (p, w) => (p && p[0] === w ? p[1] : null);
    const same = () => (pa === null && pb === null) || (pa && pb && pa[0] === pb[0] && pa[1] === pb[1]);
    const row = (label, arr, w) => ({ t: "list", label, nodes: arr.length ? arr.map((v, i) => ({ v, cls: met && at(pa, w) === i ? "c" : at(pa, w) === i ? "a" : at(pb, w) === i ? "b" : w === "C" ? "g" : "" })) : [{ v: "无", cls: "d" }], showNil: w === "C" || !C, ptrs: { pa: at(pa, w), pb: at(pb, w) } });
    const view = () => [row("A 独有的部分（后面接公共部分）", xa, "A"), row("B 独有的部分（后面接公共部分）", xb, "B"), row("公共部分", cm, "C")];
    const facts = () => [["pa 走在", onB ? "B 的路上" : "A 的路上"], ["pb 走在", onA ? "A 的路上" : "B 的路上"]];
    snap("开始", "pa 从 A 的头出发，pb 从 B 的头出发，每次各走一步。", view(), { facts: facts() });
    let guard = 0;
    while (!same() && guard++ < 100) {
      let msg = "";
      if (pa === null) { pa = headOf("B"); onB = true; msg += "pa 走完了 A，换到 <b>B 的头</b>继续走。"; } else { pa = step(pa); msg += pa === null ? "pa 走到了空。" : "pa 往前一步。"; }
      if (pb === null) { pb = headOf("A"); onA = true; msg += "pb 走完了 B，换到 <b>A 的头</b>继续走。"; } else { pb = step(pb); msg += pb === null ? "pb 走到了空。" : "pb 往前一步。"; }
      if (!same()) snap("各走一步", msg, view(), { facts: facts() });
    }
    met = true;
    if (pa === null) snap("没有交点", "两个指针同时走到了空。它们走过的总长度相同，却一直没碰到同一个节点，说明两个链表不相交。", view(), { kind: "warn", ans: null, facts: facts() });
    else snap("相遇", `pa 和 pb 同时到了 <b>${cm[pa[1]]}</b>。两个指针都走了「A 独有 + B 独有 + 若干公共」这么长，这里就是交点。`, view(), { kind: "ok", ans: cm[pa[1]], facts: facts() });
  },
  alts: [{
    t: "集合",
    note: "和简洁写法一样：先把 A 上的节点全部放进集合，再从 B 的头往后走，第一个已经在集合里的节点就是交点。要 O(m) 额外空间。",
    legend: [["a", "当前节点"], ["e", "在集合里（A 上的节点）"], ["c", "交点"]],
    build(a, snap) {
      const { xa, xb, cm } = a, seenA = new Set(), seenC = new Set();
      let cur = null, name = "headA", hit = null;
      const row = (label, arr, w) => ({ t: "list", label, nodes: arr.length ? arr.map((v, i) => ({ v, cls: hit !== null && w === "C" && i === hit ? "c" : cur && cur[0] === w && cur[1] === i ? "a" : (w === "A" && seenA.has(i)) || (w === "C" && seenC.has(i)) ? "e" : "" })) : [{ v: "无", cls: "d" }], showNil: w === "C" || !cm.length, ptrs: { [name]: cur && cur[0] === w ? cur[1] : null } });
      const view = () => [row("A 独有的部分（后面接公共部分）", xa, "A"), row("B 独有的部分（后面接公共部分）", xb, "B"), row("公共部分", cm, "C")];
      const f = () => ({ facts: [["集合大小", seenA.size + seenC.size]] });
      snap("开始", "第一步：从 A 的头走到尾，把每个节点都放进集合。比较的是节点本身，不是值。", view(), f());
      const pathA = [...xa.map((_, i) => ["A", i]), ...cm.map((_, i) => ["C", i])];
      for (const p of pathA) {
        cur = p; (p[0] === "A" ? seenA : seenC).add(p[1]);
        snap("放进集合", `A 上的节点 ${p[0] === "A" ? xa[p[1]] : cm[p[1]]} 放进集合。`, view(), f());
      }
      cur = null; name = "headB";
      snap("换到 B", "A 走完了。第二步：从 B 的头往后走，看每个节点在不在集合里。", view(), f());
      for (let i = 0; i < xb.length; i++) {
        cur = ["B", i];
        snap("不在集合里", `B 上的节点 ${xb[i]} 不在集合里，不是 A 上的节点，继续往后走。`, view(), f());
      }
      if (!cm.length) {
        cur = null;
        snap("没有交点", "B 走到了空，一直没碰到 A 上的节点，两个链表不相交。", view(), { kind: "warn", ans: null, ...f() });
        return;
      }
      cur = ["C", 0]; hit = 0;
      snap("找到交点", `节点 <b>${cm[0]}</b> 已经在集合里了：它同时在 A 和 B 上，是 B 碰到的第一个这样的节点，就是交点。`, view(), { kind: "ok", ans: cm[0], ...f() });
    },
  }],
  points: [
    { t: "比较的是节点", body: "用 <code>is</code> 判断是不是同一个节点。值相同不代表是同一个节点。" },
    { t: "走到空再换", body: "条件是 <code>if pa</code> 而不是 <code>if pa.next</code>。这样不相交时两个指针会同时为空，循环能正常结束。" },
    { t: "复杂度", body: "时间 O(m + n)，空间 O(1)。" },
  ],
};
