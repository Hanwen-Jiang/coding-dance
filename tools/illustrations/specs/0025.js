const F = require("../fig");

module.exports = {
  id: 25, name: "K 个一组翻转链表", title: "K 个一组翻转链表图解", level: "困难", topic: "链表",
  h1: "K 个一组翻转链表，数够 k 个再动手",
  lede: "这道题是「反转链表」加上分组。每一组先往前数 k 个节点，数不够就停；数够了就把这一组内部反转，再把它和前后接好。难的是接头的地方，用哑节点和几个命名清楚的指针就不会乱。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "reverse_ex1.jpg": [F.row([F.list([1, 2, 3, 4, 5], { cls: (v, i) => (i < 2 ? "e" : i < 4 ? "g" : "") }), F.list([2, 1, 4, 3, 5], { cls: (v, i) => (i < 2 ? "e" : i < 4 ? "g" : "") })], { label: "k = 2：每 2 个一组翻转，最后剩 1 个不动" })],
    "reverse_ex2.jpg": [F.row([F.list([1, 2, 3, 4, 5], { cls: (v, i) => (i < 3 ? "e" : "") }), F.list([3, 2, 1, 4, 5], { cls: (v, i) => (i < 3 ? "e" : "") })], { label: "k = 3：前 3 个翻转，剩下 2 个不够一组，不动" })],
  },
  hints: [
    { t: "拆成三件事", body: ["一、判断后面够不够 k 个节点。", "二、把这 k 个节点反转（和 206 题一样）。", "三、把反转后的这一组接回去：前一组的尾巴接它的新头，它的新尾巴接后面。"] },
    { t: "每一组要记住谁", body: ["<code>group_prev</code>：这一组前面的那个节点。", "<code>kth</code>：这一组的最后一个节点，从 <code>group_prev</code> 走 k 步得到。<code>group_next = kth.next</code> 是下一组的开头。"] },
    { t: "一个省事的技巧", body: ["反转这一组时，让 <code>prev</code> 的初始值是 <code>group_next</code> 而不是空。", "这样这一组原来的第一个节点（反转后的尾巴）会自动指向下一组，少接一次。"] },
    { t: "组内反转每一轮做什么", body: ["和 206 题一样，四行：<code>nxt = cur.next</code> 先记住下一个；<code>cur.next = prev</code> 箭头掉头；<code>prev = cur</code>、<code>cur = nxt</code> 两个指针各往前走一步。", "<code>cur</code> 走到 <code>group_next</code> 就停：这一组正好 k 个箭头掉了头，<code>prev</code> 停在 <code>kth</code>。"] },
  ],
  codes: [{ t: "标准解法：分组 + 组内反转", code: `
class Solution:
    def reverseKGroup(self, head: Optional[ListNode], k: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)       #@dummy
        group_prev = dummy              #@gp0
        while True:
            kth = group_prev            #@kth0
            for _ in range(k):          # 往前数 k 个
                kth = kth.next          #@kstep
                if not kth:             #@kchk
                    return dummy.next   # 不够 k 个，剩下的不动 #@ret
            group_next = kth.next       # 下一组的开头 #@cut
            prev = group_next           # prev 从 group_next 开始 #@prev0
            cur = group_prev.next       #@cur0
            while cur is not group_next:    # 组内反转 #@exit
                nxt = cur.next          # 先记住下一个 #@save
                cur.next = prev         # 箭头掉头 #@flip
                prev = cur              #@mprev
                cur = nxt               #@mcur
            first = group_prev.next     # 这组原来的头，现在是尾 #@first
            group_prev.next = kth       # 前面接上新的头 #@link
            group_prev = first          #@next
` }, { t: "简洁写法：递归", kind: "elegant", note: "先数够 k 个，不够就原样返回。够的话，后面的部分先递归翻好，作为这一组翻转后的尾巴。", code: `
class Solution:
    def reverseKGroup(self, head: Optional[ListNode], k: int) -> Optional[ListNode]:
        node = head
        for _ in range(k):
            if not node:
                return head
            node = node.next
        prev, cur = self.reverseKGroup(node, k), head
        for _ in range(k):
            cur.next, prev, cur = prev, cur, cur.next
        return prev
` }],
  sig: { fn: "reverseKGroup", params: ["ListNode", "int"], ret: "ListNode" },
  call: (a) => [a.v, a.k],
  cases: [[[1], 1], [[1, 2], 2], [[1, 2, 3], 1], [[1, 2, 3, 4], 4], [[1, 2, 3, 4, 5, 6, 7], 3]],
  pytest: `
s = Solution()
assert toL(s.reverseKGroup(L([1,2,3,4,5]), 2)) == [2,1,4,3,5]
assert toL(s.reverseKGroup(L([1,2,3,4,5]), 3)) == [3,2,1,4,5]
assert toL(s.reverseKGroup(L([1,2,3,4,5]), 1)) == [1,2,3,4,5]
assert toL(s.reverseKGroup(L([1,2,3,4,5,6]), 3)) == [3,2,1,6,5,4]
assert toL(s.reverseKGroup(L([1]), 1)) == [1]
`,
  legend: [["g", "group_prev"], ["e", "这一组还没掉头"], ["a", "cur"], ["b", "prev"], ["k", "已经掉头 / 翻转好"], ["w", "不够 k 个，不动"]],
  presets: [
    { label: "示例 1：k = 2", args: { v: [1, 2, 3, 4, 5], k: 2 }, note: "head = [1,2,3,4,5], k = 2", expect: [2, 1, 4, 3, 5] },
    { label: "示例 2：k = 3", args: { v: [1, 2, 3, 4, 5], k: 3 }, note: "head = [1,2,3,4,5], k = 3", expect: [3, 2, 1, 4, 5] },
    { label: "8 个，k = 3", args: { v: [1, 2, 3, 4, 5, 6, 7, 8], k: 3 }, note: "head = [1,2,3,4,5,6,7,8], k = 3", expect: [3, 2, 1, 6, 5, 4, 7, 8] },
  ],
  /*
   * 演示：和代码一行一行对上——每一步只执行一行赋值（数 k 个时 kth 每走一格一步，组内反转每个节点四步：
   * 记 nxt、箭头掉头、prev 前进、cur 前进），讲解写的就是这一行做了什么、为什么。
   * 一组处理期间节点不挪位置，只重画 next 箭头（掉头的箭头画在下面）；group_prev 移到下一组前面时，按新的链接顺序把整条链表排一遍。
   * o 是现在的链接顺序（0 号是哑节点 D），nx[i] 是 i 号位置的 next 指向第几号位置（null 是空）。
   */
  build(a, snap) {
    const k = a.k;
    let o = ["D", ...a.v], nx = o.map((_, i) => (i + 1 < o.length ? i + 1 : null)), done = 0; // done：前面已经翻好的到第几号（不含 group_prev）
    const name = (i) => (i === null || i === undefined ? "空" : o[i]);
    // st：这一步的指针（位置下标）和标记：lo..hi 是这一组（数的时候 hi 是 kth 数到哪儿）；hot：这一行改了谁的 next
    const view = (st = {}, hot = []) => [{
      t: "list", label: "链表（D 是哑节点；掉头的箭头画在下面）",
      nodes: o.map((v, i) => {
        let cls = "";
        if (i === st.gp) cls = "g";
        else if (st.tail && i > st.gp) cls = "w";
        else if (st.lo !== undefined && i >= st.lo && i <= st.hi) cls = i === st.cur ? "a" : i === st.prev ? "b" : st.flipped && st.flipped.has(i) ? "k" : "e";
        else if (i > 0 && i <= done) cls = "k";
        return { v, cls, ...(hot.includes(i) ? { ecls: "on" } : {}) };
      }),
      next: nx.slice(),
      ptrs: { dummy: st.dummy, group_prev: st.gp, kth: st.kth, group_next: st.gn, prev: st.prev, cur: st.cur, nxt: st.nxt, first: st.first },
    }];
    const facts = (gn) => [["k", k], ...(gn !== undefined ? [["group_next", name(gn)]] : [])];
    snap("dummy = ListNode(0, head)", "在最前面放一个哑节点 D，D.next 是原来的头 " + name(1) + "。这样第一组前面也有一个节点，接头时不用单独处理。", view({ dummy: 0 }), { at: "dummy", facts: facts() });
    let gp = 0;
    snap("group_prev = dummy", "group_prev 永远是「这一组前面的那个节点」：这一组翻好以后要靠它接上新的头。第一组前面就是 D。", view({ dummy: 0, gp }), { at: "gp0", facts: facts() });
    for (;;) {
      // 一、往前数 k 个：kth 每走一格是一步
      let kth = gp;
      snap("kth = group_prev", `kth 从 group_prev（${name(gp)}）出发，往后数 ${k} 个，看这一组够不够。`, view({ gp, kth }), { at: "kth0", facts: facts() });
      let i = 0;
      for (; i < k; i++) {
        kth = kth + 1 < o.length ? kth + 1 : null;
        if (kth === null) {
          snap("kth = kth.next", `kth 再往后走一格，走到了空：group_prev 后面只有 ${i} 个节点，不够 ${k} 个。`, view({ gp, tail: true }), { at: "kstep", kind: "warn", facts: facts() });
          break;
        }
        snap("kth = kth.next", `kth 往后走一格，到 ${o[kth]}（第 ${i + 1} 个）。${i + 1 === k ? `数够 ${k} 个了，这一组是 ${o.slice(gp + 1, kth + 1).join(" → ")}。` : ""}`, view({ gp, lo: gp + 1, hi: kth, kth }), { at: "kstep", facts: facts() });
      }
      if (i < k) {
        snap("if not kth", `kth 是空，条件成立：${i ? `group_prev 后面只有 ${o.slice(gp + 1).join("、")}，` : "group_prev 后面没有节点了，"}凑不够 ${k} 个。`, view({ gp, tail: true }), { at: "kchk", kind: "warn", facts: facts() });
        snap("return dummy.next", i ? `不够一组的这几个保持原样，直接返回 dummy.next。` : "直接返回 dummy.next。", view({ gp, tail: true }), { at: "ret", kind: "warn", facts: facts() });
        break;
      }
      const lo = gp + 1, hi = kth, gn = hi + 1 < o.length ? hi + 1 : null;
      const base = { gp, lo, hi, kth: hi };
      // 二、记下下一组的开头
      snap("group_next = kth.next", `group_next 记住 ${o[hi]} 的下一个：${name(gn)}${gn === null ? "（后面没有节点了）" : "，下一组的开头"}。反转时 ${o[hi]}.next 会被改掉，不先记下就找不到下一组了。`, view({ ...base, gn }), { at: "cut", facts: facts(gn) });
      // 三、组内反转
      let prev = gn;
      snap("prev = group_next", `prev 不从空开始，而是从 group_next（${name(gn)}）开始：这一组第一个节点 ${o[lo]} 反转后是尾巴，它的 next 正好该指向下一组——第一次掉头时就顺便接好了。`, view({ ...base, gn, prev }), { at: "prev0", facts: facts(gn) });
      let cur = lo;
      snap("cur = group_prev.next", `cur 从这一组的第一个节点 ${o[lo]} 开始。`, view({ ...base, gn, prev, cur }), { at: "cur0", facts: facts(gn) });
      const flipped = new Set();
      while (cur !== gn) {
        const nxt = nx[cur];
        snap("nxt = cur.next", `先用 nxt 记住 ${o[cur]} 的下一个：${name(nxt)}。下一行要改 ${o[cur]}.next，不先记下就走不到后面了。`, view({ ...base, gn, prev, cur, nxt, flipped }), { at: "save", facts: facts(gn) });
        nx[cur] = prev;
        flipped.add(cur);
        snap("cur.next = prev", `${o[cur]}.next 改成指向 prev（${name(prev)}）。${cur === lo ? `${o[cur]} 直接接上了下一组（这就是 prev 从 group_next 开始的好处）。` : "这根箭头掉了头：从往后指变成往前指。"}`, view({ ...base, gn, prev, cur, nxt, flipped }, [cur]), { at: "flip", facts: facts(gn) });
        prev = cur;
        snap("prev = cur", `prev 前进到 ${o[prev]}：下一个节点要指回它。`, view({ ...base, gn, prev, cur, nxt, flipped }), { at: "mprev", facts: facts(gn) });
        cur = nxt;
        snap("cur = nxt", cur === gn ? `cur 前进到 ${name(cur)}，也就是 group_next。` : `cur 前进到 ${o[cur]}。注意 group_prev（${name(gp)}）还指着 ${o[lo]}：这一组还没接回去。`, view({ ...base, gn, prev, cur, flipped }), { at: "mcur", facts: facts(gn) });
      }
      snap("while cur is not group_next", `cur 已经是 group_next，循环结束：这一组的 ${k} 根箭头都掉了头。prev 停在 ${o[prev]}，它是这一组新的头。`, view({ ...base, gn, prev, cur, flipped }), { at: "exit", facts: facts(gn) });
      // 四、接回前面
      snap("first = group_prev.next", `group_prev（${name(gp)}）的 next 还指着这一组原来的头 ${o[lo]}。它现在是这一组的尾巴，也是下一组前面的那个节点，先用 first 记住。`, view({ ...base, gn, prev, first: lo, flipped }), { at: "first", facts: facts(gn) });
      nx[gp] = hi;
      snap("group_prev.next = kth", `${name(gp)}.next 改成指向 kth（${o[hi]}）：前面接上了这一组新的头。现在 ${name(gp)} → ${o.slice(lo, hi + 1).reverse().join(" → ")} → ${name(gn)}。`, view({ ...base, gn, prev, first: lo, flipped }, [gp]), { at: "link", facts: facts(gn) });
      // group_prev 移到 first；按新的链接顺序把链表重新排一遍
      const order = []; for (let j = 0; j !== null; j = nx[j]) order.push(j);
      const firstLabel = o[lo];
      o = order.map((j) => o[j]);
      nx = o.map((_, j) => (j + 1 < o.length ? j + 1 : null));
      done = hi;
      gp = o.indexOf(firstLabel);
      snap("group_prev = first", `group_prev 移到 first（${firstLabel}），下一组从它后面开始。（按新的链接顺序重新排了一下：${o.slice(1).join(" → ")}。）`, view({ gp }), { at: "next", facts: facts() });
    }
    snap("完成", `返回的 dummy.next 就是结果：[${o.slice(1).join(", ")}]。`, view({}), { at: "ret", kind: "ok", ans: o.slice(1), facts: facts() });
  },
  points: [
    { t: "先数够再反转", body: "一定要先确认有 k 个节点。边反转边数的话，最后一组不够时还得再反转回来。" },
    { t: "先存 first 再改 group_prev.next", body: "<code>group_prev.next</code> 在改之前指着这一组原来的头，它反转后是尾巴，也是下一轮的 <code>group_prev</code>。" },
    { t: "复杂度", body: "每个节点被数一次、反转一次，时间 O(n)，空间 O(1)。" },
  ],
};
