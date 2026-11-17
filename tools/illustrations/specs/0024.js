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
    const o = ["D", ...a.v]; let p = 0;
    const view = (x, y) => [{ t: "list", label: "链表（D 是哑节点）", nodes: o.map((v, i) => ({ v, cls: i === p ? "g" : i === x ? "a" : i === y ? "b" : i < p ? "k" : "" })), ptrs: { prev: p, a: x, b: y } }];
    snap("开始", "prev 从哑节点 D 出发，它后面的两个节点是第一对。", view(), { at: "init" });
    while (p + 2 < o.length) {
      const x = p + 1, y = p + 2, va = o[x], vb = o[y];
      snap("找到一对", `prev 后面有两个节点：a = ${va}，b = ${vb}。`, view(x, y), { at: "pair" });
      [o[x], o[y]] = [o[y], o[x]];
      snap("改三根指针", `prev.next 指向 ${vb}；${va}.next 指向 ${vb} 原来的下一个；${vb}.next 指向 ${va}。现在顺序是 ${vb} → ${va}。`, view(y, x), { at: "swap" });
      p += 2;
      snap("跳到下一对前面", `${va} 现在排在后面，它是下一对的前一个节点，prev 移到 ${va}。`, view(), { at: "next" });
    }
    snap("完成", (p + 1 < o.length ? `后面只剩 ${o[p + 1]} 一个节点，不够一对，保持不动。` : "后面没有节点了。") + `结果是 [${o.slice(1).join(", ")}]。`, view(), { at: "done", kind: "ok", ans: o.slice(1) });
  },
  alts: [{
    t: "递归",
    code: "rec",
    note: "和简洁写法一样：每一层负责最前面的一对。先递归交换从第三个节点开始的部分，拿到结果后，第一个节点接上它，第二个节点指回第一个。",
    legend: [["a", "这一层负责的一对"], ["e", "在调用栈上，还没交换"], ["k", "已经交换好的部分"]],
    build(a, snap) {
      const v = a.v, n = v.length, calls = [], done = new Set(); let tail = [];
      const view = (cur) => [
        { t: "array", label: "原链表", items: v.map((x, i) => ({ v: x, cls: cur >= 0 && (i === cur || i === cur + 1) ? "a" : done.has(i) ? "k" : calls.some((c) => c === i || c + 1 === i) ? "e" : "" })), idx: false },
        { t: "chips", label: "递归调用栈（右边是最里层）", items: calls.map((i) => ({ v: `swapPairs(${v[i]})`, cls: i === cur ? "a" : "e" })), empty: "空" },
        { t: "chips", label: "已经交换好的部分", items: tail.map((x) => ({ v: x, cls: "k" })), empty: "还没有" },
      ];
      let i = 0;
      for (; i + 1 < n; i += 2) {
        calls.push(i);
        snap("往下递归", `swapPairs(${v[i]})：${v[i]} 和 ${v[i + 1]} 是一对。先递归处理从${i + 2 < n ? ` ${v[i + 2]}` : "空"}开始的部分，拿到结果再交换这一对。`, view(i), { at: "call" });
      }
      if (i < n) { tail = [v[i]]; done.add(i); snap("到底", `swapPairs(${v[i]})：只剩一个节点，凑不成一对，原样返回。`, view(-1), { at: "base" }); }
      else snap("到底", "swapPairs(空)：没有节点了，返回空。", view(-1), { at: "base" });
      while (calls.length) {
        const c = calls[calls.length - 1], old = tail.slice();
        tail = [v[c + 1], v[c], ...tail]; done.add(c); done.add(c + 1);
        snap("交换", `回到 swapPairs(${v[c]})：${v[c]}.next 接上下一层返回的${old.length ? ` [${old.join(", ")}]` : "空"}，${v[c + 1]}.next 指向 ${v[c]}。返回 ${v[c + 1]}，这一段变成 [${tail.join(", ")}]。`, view(c), { at: "swap" });
        calls.pop();
      }
      snap("完成", `递归全部返回，结果是 [${tail.join(", ")}]。`, view(-1), { at: "done", kind: "ok", ans: tail });
    },
  }],
  points: [
    { t: "指针赋值的顺序", body: "分三行写时，要先用掉 <code>b.next</code> 再改它。Python 的多重赋值会先算完右边再赋值，可以写成一行。" },
    { t: "循环条件", body: "<code>prev.next and prev.next.next</code>：后面至少有两个节点才交换。" },
    { t: "不要只交换值", body: "题目要求真的交换节点，不能只改节点里的值。" },
  ],
};
