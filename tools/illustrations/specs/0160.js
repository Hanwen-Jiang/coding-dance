const F = require("../fig");
// 题面配图：A、B 独有的部分右对齐，后面接同一份公共部分（Y 形）
const Y = (a, b, c, label) => F.graph([
  ...a.map((v, i) => ({ id: "a" + i, v, x: i + Math.max(0, b.length - a.length), y: 0 })),
  ...b.map((v, i) => ({ id: "b" + i, v, x: i + Math.max(0, a.length - b.length), y: 2 })),
  ...c.map((v, i) => ({ id: "c" + i, v, x: Math.max(a.length, b.length) + i, y: 1, cls: "k" })),
], [
  ...a.slice(1).map((_, i) => ["a" + i, "a" + (i + 1)]), ...(c.length && a.length ? [["a" + (a.length - 1), "c0"]] : []),
  ...b.slice(1).map((_, i) => ["b" + i, "b" + (i + 1)]), ...(c.length && b.length ? [["b" + (b.length - 1), "c0"]] : []),
  ...c.slice(1).map((_, i) => ["c" + i, "c" + (i + 1)]),
], { labels: [{ x: -1, y: 0, text: "A" }, { x: -1, y: 2, text: "B" }], label });

module.exports = {
  id: 160, name: "相交链表", title: "相交链表图解", level: "简单", topic: "链表",
  h1: "相交链表，走完自己的路再走对方的路",
  lede: "两个链表长度不同，所以两个指针同时出发不会同时到达交点。让每个指针走完自己的链表后，接着从对方的头开始走。这样两个指针走的总长度相同，会同时到达交点。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "160_statement.png": [Y(["a1", "a2"], ["b1", "b2", "b3"], ["c1", "c2", "c3"], "两个链表从 c1 开始相交，后面的节点是同一份")],
    "160_example_1_1.png": [Y([4, 1], [5, 6, 1], [8, 4, 5], "从值为 8 的节点开始相交（A、B 里前面的 1 是两个不同的节点）")],
    "160_example_2.png": [Y([1, 9, 1], [3], [2, 4], "从值为 2 的节点开始相交")],
    "160_example_3.png": [Y([2, 6, 4], [1, 5], [], "两个链表不相交")],
  },
  hints: [
    { t: "为什么直接走不行", body: ["如果两个链表在交点之前的长度一样，两个指针同时走就会同时到交点。", "问题是前面的长度可能不同，要想办法把这个差距抹掉。"] },
    { t: "把两段路拼起来", body: ["设 A 独有的部分长 <code>a</code>，B 独有的部分长 <code>b</code>，公共部分长 <code>c</code>。", "指针 pa 走 A 再走 B：<code>a + c + b</code> 步到交点。指针 pb 走 B 再走 A：<code>b + c + a</code> 步到交点。两者相等。"] },
    { t: "不相交的情况", body: ["没有交点时，两个指针都走了 <code>(a + c) + (b + c)</code> 步后同时变成空，循环也会结束，返回空。", "所以走到末尾时要走到空再换链表，不能在最后一个节点就换。"] },
  ],
  codes: [{ t: "标准解法：双指针换路", code: `
class Solution:
    def getIntersectionNode(self, headA: ListNode, headB: ListNode) -> Optional[ListNode]:
        pa, pb = headA, headB           #@init
        while pa is not pb:             #@step
            pa = pa.next if pa else headB   # 走到空就换到 B 的头 #@step
            pb = pb.next if pb else headA   #@step
        return pa                       # 交点，或者都是空 #@done
` }, { t: "简洁写法：集合（O(m+n) 空间）", key: "set", kind: "elegant", note: "把 A 的节点都放进集合，B 上第一个在集合里的节点就是交点。比较的是节点本身，不是值。", code: `
class Solution:
    def getIntersectionNode(self, headA: ListNode, headB: ListNode) -> Optional[ListNode]:
        seen = set()                    #@init
        while headA:                    #@addA
            seen.add(headA)             #@addA
            headA = headA.next          #@addA
        while headB and headB not in seen:  #@walkB,found,none
            headB = headB.next          #@walkB
        return headB                    #@found,none
` }],
  // 力扣的输入是 listA、listB 和交点位置；这里传 A 整条，B 写成「独有部分 + 接在 A 的第几个节点」，返回值判成交点是 A 的第几个节点
  sig: { fn: "getIntersectionNode", params: ["ListNode", "JoinList"], ret: "NodeIndex" },
  call: (a) => [[...a.xa, ...a.cm], [a.xb, a.cm.length ? a.xa.length : -1]],
  cases: [[[1], [[], 0]], [[1, 2], [[3], -1]], [[2, 3], [[1], 1]], [[], [[1, 2], -1]], [[1, 9, 1, 2, 4], [[3], 3]]],
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
    const headOf = (w) => (w === "A" ? (A ? ["A", 0] : C ? ["C", 0] : null) : B ? ["B", 0] : C ? ["C", 0] : null);
    const step = (p) => {
      const [w, i] = p;
      const len = w === "A" ? A : w === "B" ? B : C;
      if (i + 1 < len) return [w, i + 1];
      return w === "C" ? null : C ? ["C", 0] : null;
    };
    const at = (p, w) => (p && p[0] === w ? p[1] : null);
    let pa = headOf("A"), pb = headOf("B"), onB = false, onA = false, met = false;
    let stepsA = 0, stepsB = 0;
    const same = () => (pa === null && pb === null) || (pa && pb && pa[0] === pb[0] && pa[1] === pb[1]);
    const row = (label, arr, w, hotIdx) => ({
      t: "list",
      label,
      nodes: arr.length
        ? arr.map((v, i) => ({
          v,
          cls: met && at(pa, w) === i ? "c" : at(pa, w) === i ? "a" : at(pb, w) === i ? "b" : w === "C" ? "g" : "",
          ...(hotIdx && hotIdx.includes(i) ? { ecls: "on" } : {}),
        }))
        : [{ v: "无", cls: "d" }],
      next: arr.length ? arr.map((_, i) => (i + 1 < arr.length ? i + 1 : null)) : [null],
      showNil: w === "C" || !C,
      ptrs: { pa: at(pa, w), pb: at(pb, w) },
      ...(hotIdx && hotIdx.length ? { animEdges: hotIdx.slice() } : {}),
    });
    const view = (hotByRow = {}) => [
      row("A 独有的部分（后面接公共部分）", xa, "A", hotByRow.A),
      row("B 独有的部分（后面接公共部分）", xb, "B", hotByRow.B),
      row("公共部分", cm, "C", hotByRow.C),
    ];
    const roadA = () => (onB ? "B 的路" : "A 的路");
    const roadB = () => (onA ? "A 的路" : "B 的路");
    snap("pa, pb = headA, headB", "pa 从 A 的头出发，pb 从 B 的头出发，每次各走一步。", view(), {
      at: "init",
      facts: [["pa 走在", roadA()], ["pb 走在", roadB()], ["pa 步数", 0], ["pb 步数", 0]],
    });
    let guard = 0;
    while (!same() && guard++ < 100) {
      const prevA = pa, prevB = pb;
      const prevRoadA = roadA(), prevRoadB = roadB();
      const prevSA = stepsA, prevSB = stepsB;
      const hotByRow = { A: [], B: [], C: [] };
      let msg = "";
      if (pa === null) {
        pa = headOf("B");
        onB = true;
        msg += "pa 走完了 A（到达空），换到 <b>B 的头</b>继续走。";
      } else {
        const len = prevA[0] === "A" ? A : prevA[0] === "B" ? B : C;
        if (prevA[1] + 1 < len) hotByRow[prevA[0]].push(prevA[1]);
        pa = step(pa);
        msg += pa === null ? "pa 走到了空。" : "pa 往前走一步。";
      }
      stepsA += 1;
      if (pb === null) {
        pb = headOf("A");
        onA = true;
        msg += "pb 走完了 B（到达空），换到 <b>A 的头</b>继续走。";
      } else {
        const len = prevB[0] === "A" ? A : prevB[0] === "B" ? B : C;
        if (prevB[1] + 1 < len) hotByRow[prevB[0]].push(prevB[1]);
        pb = step(pb);
        msg += pb === null ? "pb 走到了空。" : "pb 往前走一步。";
      }
      stepsB += 1;
      const facts = [
        ["pa 走在", roadA(), prevRoadA],
        ["pb 走在", roadB(), prevRoadB],
        ["pa 步数", stepsA, prevSA],
        ["pb 步数", stepsB, prevSB],
      ];
      if (!same()) snap("各走一步", msg, view(hotByRow), { at: "step", facts });
      else {
        met = true;
        if (pa === null) {
          snap("没有交点", "两个指针同时走到了空。它们走过的总长度相同，却一直没碰到同一个节点，说明两个链表不相交。", view(hotByRow), {
            at: ["step", "done"],
            kind: "warn",
            ans: null,
            facts,
          });
        } else {
          snap("相遇！找到交点", `pa 和 pb 同时到了 <b>${cm[pa[1]]}</b>。两个指针都走了「A 独有 + B 独有 + 若干公共」这么长，这里就是交点。`, view(hotByRow), {
            at: ["step", "done"],
            kind: "ok",
            ans: cm[pa[1]],
            facts,
          });
        }
        return;
      }
    }
    met = true;
    const finalFacts = [["pa 走在", roadA()], ["pb 走在", roadB()], ["pa 步数", stepsA], ["pb 步数", stepsB]];
    if (pa === null) {
      snap("没有交点", "两个指针一开始就都是空，不相交，返回空。", view(), { at: "done", kind: "warn", ans: null, facts: finalFacts });
    } else {
      snap("相遇！找到交点", `pa 和 pb 一开始就在同一个公共节点 <b>${cm[pa[1]]}</b>，这里就是交点。`, view(), { at: "done", kind: "ok", ans: cm[pa[1]], facts: finalFacts });
    }
  },
  alts: [{
    t: "集合",
    code: "set",
    note: "和简洁写法一样：先把 A 上的节点全部放进集合，再从 B 的头往后走，第一个已经在集合里的节点就是交点。要 O(m) 额外空间。",
    legend: [["a", "当前节点"], ["e", "在集合里（A 上的节点）"], ["c", "交点"]],
    build(a, snap) {
      const { xa, xb, cm } = a, seenA = new Set(), seenC = new Set();
      const pathA = [...xa.map((_, i) => ["A", i]), ...cm.map((_, i) => ["C", i])];
      let cur = pathA.length ? pathA[0] : null, name = "headA", hit = null;
      const row = (label, arr, w, hotIdx) => ({
        t: "list",
        label,
        nodes: arr.length
          ? arr.map((v, i) => ({
            v,
            cls: hit !== null && w === "C" && i === hit ? "c" : cur && cur[0] === w && cur[1] === i ? "a" : (w === "A" && seenA.has(i)) || (w === "C" && seenC.has(i)) ? "e" : "",
            ...(hotIdx && hotIdx.includes(i) ? { ecls: "on" } : {}),
          }))
          : [{ v: "无", cls: "d" }],
        next: arr.length ? arr.map((_, i) => (i + 1 < arr.length ? i + 1 : null)) : [null],
        showNil: w === "C" || !cm.length,
        ptrs: { [name]: cur && cur[0] === w ? cur[1] : null },
        ...(hotIdx && hotIdx.length ? { animEdges: hotIdx.slice() } : {}),
      });
      const view = (hotByRow = {}) => [
        row("A 独有的部分（后面接公共部分）", xa, "A", hotByRow.A),
        row("B 独有的部分（后面接公共部分）", xb, "B", hotByRow.B),
        row("公共部分", cm, "C", hotByRow.C),
      ];
      const sz = () => seenA.size + seenC.size;
      snap("seen = set()", "第一步：从 A 的头走到尾，把每个节点都放进集合。比较的是节点本身，不是值。", view(), { at: "init", facts: [["集合大小", 0]] });
      for (let idx = 0; idx < pathA.length; idx++) {
        const p = pathA[idx];
        const prevSz = sz();
        (p[0] === "A" ? seenA : seenC).add(p[1]);
        const val = p[0] === "A" ? xa[p[1]] : cm[p[1]];
        snap("seen.add(headA)", `把 A 上的节点 <b>${val}</b> 放进集合 seen。`, view(), {
          at: "addA",
          facts: [["集合大小", sz(), prevSz]],
        });
        const nxt = idx + 1 < pathA.length ? pathA[idx + 1] : null;
        const hotByRow = { A: [], B: [], C: [] };
        if (nxt && nxt[0] === p[0]) hotByRow[p[0]].push(p[1]);
        cur = nxt;
        snap("headA = headA.next", cur === null ? "headA 走到了链表 A 的尽头（空）。" : `headA 往前移动到 <b>${cur[0] === "A" ? xa[cur[1]] : cm[cur[1]]}</b>。`, view(hotByRow), {
          at: "addA",
          facts: [["集合大小", sz()]],
        });
      }
      name = "headB";
      cur = xb.length ? ["B", 0] : cm.length ? ["C", 0] : null;
      snap("从 B 的头出发", "A 走完了。第二步：headB 从 B 的头往后走，检查每个节点在不在集合里。", view(), {
        at: "walkB",
        facts: [["集合大小", sz()]],
      });
      for (let i = 0; i < xb.length; i++) {
        cur = ["B", i];
        snap("检查 headB", `B 上的节点 ${xb[i]} 不在集合里，不是 A 上的节点。`, view(), {
          at: "walkB",
          facts: [["集合大小", sz()]],
        });
        const nxt = i + 1 < xb.length ? ["B", i + 1] : cm.length ? ["C", 0] : null;
        const hotByRow = i + 1 < xb.length ? { B: [i] } : {};
        cur = nxt;
        snap("headB = headB.next", cur === null ? "headB 走到了链表 B 的尽头（空）。" : `headB 往前移动到 <b>${cur[0] === "B" ? xb[cur[1]] : cm[cur[1]]}</b>。`, view(hotByRow), {
          at: "walkB",
          facts: [["集合大小", sz()]],
        });
      }
      if (!cm.length) {
        cur = null;
        snap("没有交点", "B 走到了空，一直没碰到 A 上的节点，两个链表不相交。", view(), {
          at: "none",
          kind: "warn",
          ans: null,
          facts: [["集合大小", sz()]],
        });
        return;
      }
      cur = ["C", 0];
      hit = 0;
      snap("找到交点", `节点 <b>${cm[0]}</b> 已经在集合里了！它是 B 碰到的第一个同时也在 A 上的节点，就是交点。`, view(), {
        at: "found",
        kind: "ok",
        ans: cm[0],
        facts: [["集合大小", sz()], ["交点值", cm[0]]],
      });
    },
  }],
  points: [
    { t: "比较的是节点", body: "用 <code>is</code> 判断是不是同一个节点。值相同不代表是同一个节点。" },
    { t: "走到空再换", body: "条件是 <code>if pa</code> 而不是 <code>if pa.next</code>。这样不相交时两个指针会同时为空，循环能正常结束。" },
    { t: "复杂度", body: "时间 O(m + n)，空间 O(1)。" },
  ],
};
