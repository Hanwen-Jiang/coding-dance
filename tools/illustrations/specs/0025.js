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
    { t: "组内反转每一轮做什么", body: ["和 206 题一样，三步：<code>nxt = cur.next</code> 先记住下一个；<code>cur.next = prev</code> 箭头掉头；<code>prev, cur = cur, nxt</code> 两个指针往前走。", "<code>cur</code> 走到 <code>group_next</code> 就停：这一组正好 k 个箭头掉了头，<code>prev</code> 停在 <code>kth</code>。"] },
  ],
  codes: [{ t: "标准解法：分组 + 组内反转", code: `
class Solution:
    def reverseKGroup(self, head: Optional[ListNode], k: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)       #@init
        group_prev = dummy              #@init
        while True:                     #@count
            kth = group_prev            #@count
            for _ in range(k):          # 往前数 k 个 #@count
                kth = kth.next          #@count
                if not kth:             #@count
                    return dummy.next   # 不够 k 个，剩下的不动 #@done
            group_next = kth.next       # 下一组的开头 #@cut
            prev, cur = group_next, group_prev.next  # prev 从 group_next 开始 #@setup
            while cur is not group_next:    # 组内反转 #@flip
                nxt = cur.next          # 先记住下一个 #@flip
                cur.next = prev         # 箭头掉头 #@flip
                prev, cur = cur, nxt    # 两个指针往前走 #@move
            first = group_prev.next     # 这组原来的头，现在是尾 #@link
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
   * 演示：每一组拆成和代码一样的几步，指针一根一根地改。
   * 一组处理期间节点不挪位置，只重画 next 箭头（掉头的箭头画在下面）；接好之后再按新的链接顺序把整条链表排一遍。
   * o 是现在的链接顺序（0 号是哑节点 D），nx[i] 是 i 号位置的 next 指向第几号位置（null 是空）。
   */
  build(a, snap) {
    const k = a.k;
    let o = ["D", ...a.v], nx = o.map((_, i) => (i + 1 < o.length ? i + 1 : null)), done = 0; // done：前面已经翻好的到第几号（不含 group_prev）
    const name = (i) => (i === null || i === undefined ? "空" : o[i]);
    // st：这一步的指针（位置下标）和一些标记；hot：箭头刚改过的那个节点
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
      ptrs: { group_prev: st.gp, kth: st.kth, group_next: st.gn, prev: st.prev, cur: st.cur, nxt: st.nxt, first: st.first },
    }];
    const facts = (st) => [["k", k], ...(st.gnName !== undefined ? [["group_next", st.gnName]] : [])];
    let gp = 0;
    snap("开始", `k = ${k}。前面放一个哑节点 D，group_prev 从 D 出发：它永远是「这一组前面的那个节点」，第一组前面没有节点，就用 D 代替。`, view({ gp }), { at: "init", facts: [["k", k]] });
    for (;;) {
      // 一、往前数 k 个
      if (gp + k >= o.length) {
        const left = o.length - 1 - gp;
        snap("不够 k 个", left ? `从 group_prev 往后数，只剩 ${left} 个节点，不够 ${k} 个。数的时候走到了空，直接返回 dummy.next，这几个保持原样。` : "group_prev 后面没有节点了，数的时候第一步就走到空，返回 dummy.next。", view({ gp, tail: true }), { at: ["count", "done"], kind: "warn", facts: [["k", k]] });
        break;
      }
      const lo = gp + 1, hi = gp + k, gn = hi + 1 < o.length ? hi + 1 : null;
      snap("数出一组", `从 group_prev（${name(gp)}）往后走 ${k} 步，kth 停在 ${o[hi]}，够 ${k} 个。这一组是 ${o.slice(lo, hi + 1).join(" → ")}。`, view({ gp, lo, hi, kth: hi }), { at: "count", facts: [["k", k]] });
      // 二、记下下一组的开头
      snap("记下 group_next", `group_next = kth.next = ${name(gn)}${gn === null ? "：后面没有节点了" : "，是下一组的开头"}。反转时 kth 的 next 会被改掉，所以要先记下来。`, view({ gp, lo, hi, kth: hi, gn }), { at: "cut", facts: facts({ gnName: name(gn) }) });
      // 三、组内反转：prev 从 group_next 开始
      let prev = gn, cur = lo;
      const flipped = new Set();
      snap("准备反转", `cur 从这一组的第一个节点 ${o[lo]} 开始。prev 不从空开始，而是从 group_next（${name(gn)}）开始：${o[lo]} 反转后是这一组的尾巴，它的 next 正好该指向下一组，这样省得最后再接一次。`, view({ gp, lo, hi, kth: hi, gn, prev, cur }), { at: "setup", facts: facts({ gnName: name(gn) }) });
      while (cur !== gn) {
        const nxt = nx[cur];
        nx[cur] = prev;
        flipped.add(cur);
        snap("箭头掉头", `先用 nxt 记住 ${o[cur]} 的下一个（${name(nxt)}），再把 ${o[cur]}.next 改成指向 prev（${name(prev)}）。${cur === lo ? `${o[cur]} 现在直接接上了下一组（这就是 prev 从 group_next 开始的好处）。` : "箭头从往后指变成往前指。"}`, view({ gp, lo, hi, kth: hi, gn, prev, cur, nxt, flipped }, [cur]), { at: "flip", facts: facts({ gnName: name(gn) }) });
        prev = cur; cur = nxt;
        snap("往前走", cur === gn
          ? `prev 移到 ${o[prev]}，cur 移到 ${name(cur)}——走到了 group_next，这一组的 ${k} 个箭头都掉了头，循环结束。prev 停在 kth（${o[hi]}），它是这一组新的头。`
          : `prev 移到 ${o[prev]}，cur 移到 ${o[cur]}。注意 group_prev（${name(gp)}）还指着 ${o[lo]}：这一组还没接回去。`,
        view({ gp, lo, hi, kth: hi, gn, prev, cur, flipped }), { at: "move", facts: facts({ gnName: name(gn) }) });
      }
      // 四、接回前面
      nx[gp] = hi;
      snap("接回前面", `这时 group_prev（${name(gp)}）的 next 还是这一组原来的头 ${o[lo]}，先用 first 记住它（它现在是尾巴）。再让 group_prev.next = kth，前面接上新的头 ${o[hi]}。`, view({ gp, lo, hi, kth: hi, gn, prev, first: lo, flipped }, [gp]), { at: "link", facts: facts({ gnName: name(gn) }) });
      // 按新的链接顺序重新排一遍，group_prev 移到 first
      const order = []; for (let i = 0; i !== null; i = nx[i]) order.push(i);
      const firstLabel = o[lo];
      o = order.map((i) => o[i]);
      nx = o.map((_, i) => (i + 1 < o.length ? i + 1 : null));
      done = hi;
      gp = o.indexOf(firstLabel);
      snap("下一组", `按新的链接顺序排一下：${o.slice(1).join(" → ")}。group_prev 移到 first（${firstLabel}），下一组从它后面开始。`, view({ gp }), { at: "next", facts: [["k", k]] });
    }
    snap("完成", `返回 dummy.next，结果是 [${o.slice(1).join(", ")}]。`, view({}), { at: "done", kind: "ok", ans: o.slice(1), facts: [["k", k]] });
  },
  points: [
    { t: "先数够再反转", body: "一定要先确认有 k 个节点。边反转边数的话，最后一组不够时还得再反转回来。" },
    { t: "先存 first 再改 group_prev.next", body: "<code>group_prev.next</code> 在改之前指着这一组原来的头，它反转后是尾巴，也是下一轮的 <code>group_prev</code>。" },
    { t: "复杂度", body: "每个节点被数一次、反转一次，时间 O(n)，空间 O(1)。" },
  ],
};
