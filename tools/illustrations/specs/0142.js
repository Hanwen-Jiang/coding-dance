const F = require("../fig");

module.exports = {
  id: 142, name: "环形链表 II", title: "环形链表 II 图解", level: "中等", topic: "链表",
  h1: "环形链表 II，相遇之后再从头走一遍",
  lede: "先用快慢指针找到相遇点。然后让一个指针回到头节点，两个指针都改成一次走一步，它们再次相遇的地方就是环的入口。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "circularlinkedlist.png": [F.list([3, 2, 0, -4], { label: "pos = 1：环的入口是下标 1 的节点", cycle: 1, cls: (v, i) => (i === 1 ? "c" : "") })],
    "circularlinkedlist_test2.png": [F.list([1, 2], { label: "pos = 0：环的入口是头节点", cycle: 0, cls: (v, i) => (i === 0 ? "c" : "") })],
    "circularlinkedlist_test3.png": [F.list([1], { label: "pos = -1：没有环，返回空" })],
  },
  hints: [
    { t: "第一步和 141 一样", body: ["快慢指针相遇，说明有环。但相遇点一般不是入口。"] },
    { t: "算一下走了多远", body: ["设头节点到入口的距离是 <code>a</code>，入口到相遇点是 <code>b</code>，相遇点再走回入口是 <code>c</code>。", "相遇时 slow 走了 <code>a + b</code>，fast 走了它的两倍，同时 fast 比 slow 多绕了若干整圈。", "所以 <code>a + b</code> 等于若干整圈的长度，也就是 <code>a = c + 若干整圈</code>。"] },
    { t: "这个等式的意思", body: ["一个指针从头节点走 <code>a</code> 步到入口。另一个指针从相遇点走 <code>a</code> 步，等于走 <code>c</code> 步再绕几圈，也正好到入口。", "所以让它们同时出发、每次各走一步，会在入口相遇。"] },
  ],
  codes: [{ t: "标准解法：快慢指针，相遇后从头再走", code: `
class Solution:
    def detectCycle(self, head: Optional[ListNode]) -> Optional[ListNode]:
        slow = fast = head              #@init
        while fast and fast.next:       #@step
            slow = slow.next            #@step
            fast = fast.next.next       #@step
            if slow is fast:            # 相遇，有环 #@step,meet
                p = head                #@meet
                while p is not slow:    # 两边各走一步，在入口相遇 #@walk,entry
                    p = p.next          #@walk
                    slow = slow.next    #@walk
                return p                #@entry
        return None                     #@none
` }, { t: "简洁写法：集合记走过的节点（O(n) 空间）", key: "set", kind: "elegant", note: "第一个重复出现的节点就是环的入口。", code: `
class Solution:
    def detectCycle(self, head: Optional[ListNode]) -> Optional[ListNode]:
        seen = set()                    #@init
        while head and head not in seen:  #@add,found,none
            seen.add(head)              #@add
            head = head.next            #@add
        return head                     #@found,none
` }],
  sig: { fn: "detectCycle", params: ["CycleList"], ret: "NodeIndex" },
  call: (a) => [[a.v, a.pos]],
  cases: [[[[1], 0]], [[[1, 2], 0]], [[[], -1]], [[[1, 2, 3], -1]], [[[1, 2, 3], 2]]],
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
  method: "快慢指针",
  legend: [["a", "slow"], ["b", "fast"], ["g", "从头出发的 p"], ["c", "环的入口"]],
  presets: [
    { label: "示例 1", args: { v: [3, 2, 0, -4], pos: 1 }, note: "head = [3,2,0,-4], pos = 1", expect: 1 },
    { label: "入口靠后", args: { v: [1, 2, 3, 4, 5, 6, 7], pos: 3 }, note: "head = [1,2,3,4,5,6,7], pos = 3", expect: 3 },
    { label: "没有环", args: { v: [1, 2, 3], pos: -1 }, note: "head = [1,2,3], pos = -1", expect: null },
  ],
  build(a, snap) {
    const v = a.v, n = v.length;
    const next = v.map((_, i) => (i + 1 < n ? i + 1 : a.pos >= 0 ? a.pos : null));
    if (!n) {
      snap("空链表", "链表是空的，没有环，返回空。", [{ t: "note", label: "链表", html: "空" }], { at: "none", kind: "warn", ans: null });
      return;
    }
    let slow = 0, fast = 0, p = null;
    let sSteps = 0, fSteps = 0, pSteps = 0;
    const view = (opts = {}) => [{
      t: "list",
      label: "链表（实线弧线是尾节点接回环入口的指针）",
      nodes: v.map((x, i) => ({
        v: x,
        cls: i === opts.entry ? "c" : i === slow ? "a" : i === p ? "g" : i === fast ? "b" : "",
        ...(opts.hot && opts.hot.includes(i) ? { ecls: "on" } : {}),
      })),
      next: next.slice(),
      ptrs: p === null ? { slow, fast } : { p, slow },
      ...(opts.animEdges ? { animEdges: opts.animEdges.slice() } : {}),
    }];
    snap("slow = fast = head", "第一阶段：slow 每次走 1 步，fast 每次走 2 步，从头节点出发寻找相遇点。", view(), {
      at: "init",
      facts: [["阶段", "1. 找相遇点"], ["slow 步数", 0], ["fast 步数", 0]],
    });
    let met = false;
    while (fast !== null && next[fast] !== null) {
      const prevS = slow, prevF1 = fast, prevF2 = next[fast];
      slow = next[slow];
      fast = next[next[fast]];
      sSteps += 1;
      fSteps += 2;
      const hot = [prevS, prevF1, ...(prevF2 !== null ? [prevF2] : [])];
      if (slow === fast) {
        met = true;
        snap("相遇！有环", `slow 走 1 步、fast 走 2 步后在 <b>${v[slow]}</b>（下标 ${slow}）相遇，说明链表有环！但相遇点一般不是环的入口。`, view({ hot, animEdges: hot }), {
          at: ["step", "meet"],
          facts: [["阶段", "已相遇", "1. 找相遇点"], ["slow 步数", sSteps, sSteps - 1], ["fast 步数", fSteps, fSteps - 2]],
        });
        break;
      }
      snap("各走一步/两步", `slow 走到 <b>${v[slow]}</b>，fast ${fast === null ? "走出了链表" : `走到 <b>${v[fast]}</b>`}。`, view({ hot, animEdges: hot }), {
        at: "step",
        facts: [["阶段", "1. 找相遇点"], ["slow 步数", sSteps, sSteps - 1], ["fast 步数", fSteps, fSteps - 2]],
      });
    }
    if (!met) {
      snap("没有环", "fast 走到了尽头（空），链表没有环，返回空。", view(), {
        at: "none",
        kind: "warn",
        ans: null,
        facts: [["阶段", "无环", "1. 找相遇点"], ["slow 步数", sSteps], ["fast 步数", fSteps]],
      });
      return;
    }
    fast = null;
    p = 0;
    snap("p = head（第二阶段）", `设指针 p 从头节点 <b>${v[0]}</b> 出发，slow 留在相遇点 <b>${v[slow]}</b>。接下来两边每次都只走 1 步。`, view(), {
      at: "meet",
      facts: [["阶段", "2. 找入口", "已相遇"], ["p 步数", 0], ["slow 步数", sSteps]],
    });
    while (p !== slow) {
      const prevP = p, prevS = slow;
      p = next[p];
      slow = next[slow];
      pSteps += 1;
      sSteps += 1;
      if (p !== slow) {
        snap("两边各走一步", `p 往前走到 <b>${v[p]}</b>，slow 往前走到 <b>${v[slow]}</b>，还没相遇，继续走。`, view({ hot: [prevP, prevS], animEdges: [prevP, prevS] }), {
          at: "walk",
          facts: [["阶段", "2. 找入口"], ["p 步数", pSteps, pSteps - 1], ["slow 步数", sSteps, sSteps - 1]],
        });
      } else {
        snap("再次相遇", `p 走到 <b>${v[p]}</b>，slow 也走到了 <b>${v[slow]}</b>，两个指针重合！`, view({ hot: [prevP, prevS], animEdges: [prevP, prevS] }), {
          at: "walk",
          facts: [["阶段", "2. 找入口"], ["p 步数", pSteps, pSteps - 1], ["slow 步数", sSteps, sSteps - 1]],
        });
      }
    }
    const backHot = a.pos >= 0 ? [n - 1] : [];
    snap("找到入口", `p 和 slow 在 <b>${v[p]}</b> 相遇，这里就是环的入口（下标 ${p}）。`, view({ entry: p, hot: backHot, animEdges: backHot }), {
      at: "entry",
      kind: "ok",
      ans: p,
      facts: [["阶段", "找到入口", "2. 找入口"], ["入口下标", p], ["p 步数", pSteps]],
    });
  },
  alts: [{
    t: "集合",
    code: "set",
    note: "和简洁写法一样：把走过的节点放进集合，第一个第二次走到的节点就是环的入口。要 O(n) 额外空间。",
    legend: [["a", "当前节点"], ["e", "已经在 seen 里"], ["c", "环的入口"]],
    build(a, snap) {
      const v = a.v, n = v.length;
      const next = v.map((_, i) => (i + 1 < n ? i + 1 : a.pos >= 0 ? a.pos : null));
      if (!n) {
        snap("空链表", "链表是空的，没有环，返回空。", [{ t: "note", label: "链表", html: "空" }], { at: "none", kind: "warn", ans: null });
        return;
      }
      const seen = [];
      let h = 0;
      const view = (opts = {}) => [
        {
          t: "list",
          label: "链表",
          nodes: v.map((x, i) => ({
            v: x,
            cls: i === opts.hit ? "c" : i === h ? "a" : seen.includes(i) ? "e" : "",
            ...(opts.hot === i ? { ecls: "on" } : {}),
          })),
          next: next.slice(),
          ptrs: { head: h },
          ...(opts.animEdges ? { animEdges: opts.animEdges.slice() } : {}),
        },
        {
          t: "chips",
          label: "seen（存的是节点本身，这里写成 值#下标）",
          items: seen.map((i) => ({ v: `${v[i]}#${i}`, cls: i === opts.added ? "a" : i === opts.hit ? "c" : "" })),
          empty: "空",
        },
      ];
      snap("seen = set()", "从头节点出发，把走过的每个节点都放进集合 seen。", view(), { at: "init", facts: [["seen 大小", 0]] });
      while (h !== null && !seen.includes(h)) {
        const cur = h;
        const prevSize = seen.length;
        seen.push(cur);
        snap("seen.add(head)", `${v[cur]}#${cur} 不在 seen 里，它是第一次走到，放进 seen。`, view({ added: cur }), {
          at: "add",
          facts: [["seen 大小", seen.length, prevSize]],
        });
        h = next[cur];
        snap("head = head.next", `head 往前移动到${h === null ? "空（链表末尾）" : ` <b>${v[h]}#${h}</b>`}。`, view({ hot: h !== null ? cur : undefined, animEdges: h !== null ? [cur] : undefined }), {
          at: "add",
          facts: [["seen 大小", seen.length]],
        });
      }
      if (h === null) {
        snap("没有环", "走到了空，链表没有环，返回空。", view(), { at: "none", kind: "warn", ans: null, facts: [["seen 大小", seen.length]] });
      } else {
        const backHot = a.pos >= 0 ? [n - 1] : [];
        snap("找到入口", `${v[h]}#${h} 已经在 seen 里了！它是第一个被走到两次的节点，就是环的入口（下标 ${h}）。`, view({ hit: h, hot: backHot[0], animEdges: backHot }), {
          at: "found",
          kind: "ok",
          ans: h,
          facts: [["seen 大小", seen.length], ["入口下标", h]],
        });
      }
    },
  }],
  points: [
    { t: "第二阶段都走一步", body: "相遇之后两个指针的速度要一样，都是每次一步。" },
    { t: "入口就是头节点时", body: "这时 a = 0，相遇点就是头节点，第二阶段的循环一次都不执行，直接返回。" },
    { t: "复杂度", body: "时间 O(n)，空间 O(1)。" },
  ],
};
