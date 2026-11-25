const F = require("../fig");

module.exports = {
  id: 24, name: "两两交换链表中的节点", title: "两两交换链表节点图解", level: "中等", topic: "链表",
  h1: "两两交换链表中的节点，每次改三根指针",
  lede: "每次处理一对相邻的节点。站在这一对的前一个节点上，改三根指针就能把它们换过来，然后跳到下一对前面。用哑节点让第一对也有「前一个节点」。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "swap_ex1.jpg": [F.row([F.list([1, 2, 3, 4], { cls: (v, i) => (i < 2 ? "e" : "g") }), F.list([2, 1, 4, 3], { cls: (v, i) => (i < 2 ? "e" : "g") })], { label: "相邻的两个节点一组，组内交换" })],
  },
  hints: [
    { t: "交换一对需要知道什么", body: ["要交换 <code>a</code> 和 <code>b</code>，光有它们俩不够，还要知道 <code>a</code> 前面的节点 <code>prev</code>，因为 <code>prev.next</code> 要从 <code>a</code> 改成 <code>b</code>。"] },
    { t: "三根指针", body: ["原来：<code>prev → a → b → 后面</code>。目标：<code>prev → b → a → 后面</code>。", "<code>prev.next = b</code>；<code>a.next = b.next</code>；<code>b.next = a</code>。"] },
    { t: "下一对从哪开始", body: ["交换后 <code>a</code> 在这一对的后面，它正好是下一对的前一个节点，所以 <code>prev = a</code>。", "剩下不足两个节点时停止。"] },
  ],
  codes: [{ t: "标准解法：哑节点 + 迭代", code: `
class Solution:
    def swapPairs(self, head: Optional[ListNode]) -> Optional[ListNode]:
        dummy = ListNode(0, head)       #@init
        prev = dummy                    #@init
        while prev.next and prev.next.next:     #@pair
            a, b = prev.next, prev.next.next    #@pair
            prev.next, a.next, b.next = b, b.next, a   # 三根指针一起改 #@swap
            prev = a                    # a 现在在后面，是下一对的前驱 #@next
        return dummy.next               #@done
` }, { t: "简洁写法：递归", key: "rec", kind: "elegant", note: "交换前两个，第一个的后面接上「从第三个开始两两交换的结果」。", code: `
class Solution:
    def swapPairs(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if not head or not head.next:   #@base
            return head                 #@base
        nxt = head.next                 #@call
        head.next = self.swapPairs(nxt.next)    #@call,swap
        nxt.next = head                 #@swap
        return nxt                      #@swap,done
` }],
  sig: { fn: "swapPairs", params: ["ListNode"], ret: "ListNode" },
  call: (a) => [a.v],
  cases: [[[]], [[1]], [[1, 2, 3]], [[1, 2]]],
  pytest: `
s = Solution()
assert toL(s.swapPairs(L([1,2,3,4]))) == [2,1,4,3]
assert toL(s.swapPairs(L([]))) == []
assert toL(s.swapPairs(L([1]))) == [1]
assert toL(s.swapPairs(L([1,2,3]))) == [2,1,3]
`,
  method: "迭代",
  legend: [["g", "prev"], ["a", "a"], ["b", "b"], ["k", "已经交换好"]],
  presets: [
    { label: "示例 1", args: { v: [1, 2, 3, 4] }, note: "head = [1,2,3,4]", expect: [2, 1, 4, 3] },
    { label: "奇数个", args: { v: [1, 2, 3, 4, 5] }, note: "head = [1,2,3,4,5]", expect: [2, 1, 4, 3, 5] },
  ],
  build(a, snap) {
    let o = ["D", ...a.v], nx = o.map((_, i) => (i + 1 < o.length ? i + 1 : null)), p = 0, done = 0, pairs = 0;
    const name = (i) => (i === null || i === undefined ? "空" : o[i]);
    const view = (opts = {}) => [{
      t: "list",
      label: "链表（D 是哑节点；虚红线 × 表示断开的旧指针，高亮弧线表示新接的指针）",
      nodes: o.map((v, i) => ({
        v,
        cls: i === p ? "g" : i === opts.a ? "a" : i === opts.b ? "b" : i > 0 && i <= done ? "k" : "",
        ...(opts.hot && opts.hot.includes(i) ? { ecls: "on" } : {}),
      })),
      next: nx.slice(),
      ptrs: { prev: p, a: opts.a ?? null, b: opts.b ?? null },
      ...(opts.ghostEdges && opts.ghostEdges.length ? { ghostEdges: opts.ghostEdges.map((e) => e.slice()) } : {}),
      ...(opts.animEdges && opts.animEdges.length ? { animEdges: opts.animEdges.slice() } : {}),
    }];
    snap("开始", "prev 从哑节点 D 出发，它后面的两个节点是第一对。", view(), { at: "init", facts: [["已交换对数", 0]] });
    while (p + 2 < o.length) {
      const x = p + 1, y = p + 2, after = y + 1 < o.length ? y + 1 : null, va = o[x], vb = o[y];
      snap("找到一对", `prev（${name(p)}）后面有两个节点：a = <b>${va}</b>，b = <b>${vb}</b>。`, view({ a: x, b: y }), { at: "pair", facts: [["已交换对数", pairs]] });
      const oldPrevNext = nx[p];
      nx[p] = y;
      snap(
        "prev.next = b",
        `先把 ${name(p)}.next 改成指向 b（<b>${vb}</b>），断开原来指往 ${name(oldPrevNext)} 的箭头。`,
        view({ a: x, b: y, hot: [p], animEdges: [p], ghostEdges: [[p, oldPrevNext]] }),
        { at: "swap", facts: [["已交换对数", pairs]] },
      );
      const oldANext = nx[x];
      nx[x] = after;
      snap(
        "a.next = b.next",
        `再把 ${va}.next 改成指向 b 原来的下一个（<b>${name(after)}</b>），断开原来指往 ${name(oldANext)} 的箭头。`,
        view({ a: x, b: y, hot: [x], animEdges: [x], ghostEdges: [[x, oldANext]] }),
        { at: "swap", facts: [["已交换对数", pairs]] },
      );
      const oldBNext = nx[y];
      nx[y] = x;
      const prevPairs = pairs;
      pairs += 1;
      snap(
        "b.next = a",
        `最后把 ${vb}.next 指回 a（<b>${va}</b>）${oldBNext !== null ? `，断开原来指往 ${name(oldBNext)} 的箭头` : ""}。这一对交换完成：${vb} → ${va}。`,
        view({ a: x, b: y, hot: [y], animEdges: [y], ...(oldBNext !== null ? { ghostEdges: [[y, oldBNext]] } : {}) }),
        { at: "swap", facts: [["已交换对数", pairs, prevPairs]] },
      );
      const order = [];
      for (let j = 0; j !== null; j = nx[j]) order.push(j);
      o = order.map((j) => o[j]);
      nx = o.map((_, j) => (j + 1 < o.length ? j + 1 : null));
      p = order.indexOf(x);
      done = p;
      snap("跳到下一对前面", `${va} 现在排在后面，它是下一对的前一个节点，prev 移到 <b>${va}</b>。`, view(), { at: "next", facts: [["已交换对数", pairs]] });
    }
    snap("完成", (p + 1 < o.length ? `后面只剩 ${o[p + 1]} 一个节点，不够一对，保持不动。` : "后面没有节点了。") + `结果是 [${o.slice(1).join(", ")}]。`, view(), { at: "done", kind: "ok", ans: o.slice(1), facts: [["已交换对数", pairs]] });
  },
  alts: [{
    t: "递归",
    code: "rec",
    note: "和简洁写法一样：每一层负责最前面的一对。先递归交换从第三个节点开始的部分，拿到结果后，第一个节点接上它，第二个节点指回第一个。",
    legend: [["a", "这一层的 head"], ["b", "nxt"], ["e", "在调用栈上，还没交换"], ["c", "返回的头"], ["k", "已经交换好的部分"]],
    build(a, snap) {
      const v = a.v, n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : null)), calls = [], done = new Set();
      let retHead = null;
      const name = (i) => (i === null || i === undefined ? "空" : v[i]);
      const view = (cur, opts = {}) => [
        {
          t: "list",
          label: "链表（虚红线 × 表示断开的旧指针，高亮弧线表示新接的指针）",
          nodes: v.map((x, i) => ({
            v: x,
            cls: i === cur ? "a" : i === opts.nxt ? "b" : i === opts.retHead ? "c" : done.has(i) ? "k" : calls.some((c) => c === i || c + 1 === i) ? "e" : "",
            ...(opts.hot && opts.hot.includes(i) ? { ecls: "on" } : {}),
          })),
          next: next.slice(),
          ptrs: { head: cur >= 0 ? cur : null, nxt: opts.nxt ?? null, 返回头: opts.retHead ?? null },
          ...(opts.ghostEdges && opts.ghostEdges.length ? { ghostEdges: opts.ghostEdges.map((e) => e.slice()) } : {}),
          ...(opts.animEdges && opts.animEdges.length ? { animEdges: opts.animEdges.slice() } : {}),
        },
        { t: "chips", label: "递归调用栈（右边是最里层）", items: calls.map((i) => ({ v: `swapPairs(${v[i]})`, cls: i === cur ? "a" : "e" })), empty: "空" },
      ];
      if (!n) {
        snap("到底", "head 为空，直接返回空。", [{ t: "note", label: "链表", html: "空" }], { at: "base", kind: "ok", ans: [], facts: [["栈深度", 0]] });
        return;
      }
      let i = 0;
      for (; i + 1 < n; i += 2) {
        const prevDepth = calls.length;
        calls.push(i);
        snap("往下递归", `swapPairs(${v[i]})：<b>${v[i]}</b> 和 <b>${v[i + 1]}</b> 是一对。先递归处理从${i + 2 < n ? ` <b>${v[i + 2]}</b>` : "空"}开始的部分，拿到结果再交换这一对。`, view(i, { nxt: i + 1 }), { at: "call", facts: [["栈深度", calls.length, prevDepth]] });
      }
      if (i < n) {
        retHead = i;
        done.add(i);
        snap("到底", `swapPairs(${v[i]})：只剩一个节点 <b>${v[i]}</b>，凑不成一对，原样返回。`, view(-1, { retHead }), { at: "base", facts: [["栈深度", calls.length]] });
      } else {
        retHead = null;
        snap("到底", "swapPairs(空)：没有节点了，返回空。", view(-1, { retHead }), { at: "base", facts: [["栈深度", calls.length]] });
      }
      while (calls.length) {
        const c = calls[calls.length - 1], nxt = c + 1;
        const oldHeadNext = next[c];
        next[c] = retHead;
        snap(
          "head.next = swapPairs(...)",
          `回到 swapPairs(${v[c]})：把 <b>${v[c]}.next</b> 接上下一层返回的 <b>${name(retHead)}</b>${oldHeadNext !== null ? `，断开原来指往 ${name(oldHeadNext)} 的箭头` : ""}。`,
          view(c, { nxt, retHead, hot: [c], animEdges: [c], ...(oldHeadNext !== null ? { ghostEdges: [[c, oldHeadNext]] } : {}) }),
          { at: ["call", "swap"], facts: [["栈深度", calls.length]] },
        );
        const oldNxtNext = next[nxt];
        next[nxt] = c;
        retHead = nxt;
        done.add(c);
        done.add(nxt);
        snap(
          "nxt.next = head",
          `让 <b>${v[nxt]}.next</b> 指回 <b>${v[c]}</b>${oldNxtNext !== null ? `，断开原来指往 ${name(oldNxtNext)} 的箭头` : ""}。这一对的头变成 <b>${v[nxt]}</b>。`,
          view(c, { nxt, retHead, hot: [nxt], animEdges: [nxt], ...(oldNxtNext !== null ? { ghostEdges: [[nxt, oldNxtNext]] } : {}) }),
          { at: "swap", facts: [["栈深度", calls.length]] },
        );
        const prevDepth = calls.length;
        calls.pop();
        snap("return nxt", `返回新的头节点 <b>${v[retHead]}</b> 给上一层。`, view(-1, { retHead }), { at: "swap", facts: [["栈深度", calls.length, prevDepth]] });
      }
      const res = [];
      for (let q = retHead; q !== null; q = next[q]) res.push(v[q]);
      snap("完成", `递归全部返回，结果是 [${res.join(", ")}]。`, view(-1, { retHead }), { at: "done", kind: "ok", ans: res, facts: [["栈深度", 0]] });
    },
  }],
  points: [
    { t: "指针赋值的顺序", body: "分三行写时，要先用掉 <code>b.next</code> 再改它。Python 的多重赋值会先算完右边再赋值，可以写成一行。" },
    { t: "循环条件", body: "<code>prev.next and prev.next.next</code>：后面至少有两个节点才交换。" },
    { t: "不要只交换值", body: "题目要求真的交换节点，不能只改节点里的值。" },
  ],
};
