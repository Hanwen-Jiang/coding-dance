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
            group_next = kth.next       #@rev
            prev, cur = group_next, group_prev.next  #@rev
            while cur is not group_next:    # 组内反转 #@rev
                cur.next, prev, cur = prev, cur, cur.next  #@rev
            first = group_prev.next     # 这组原来的头，现在是尾 #@rev
            group_prev.next = kth       # 前面接上新的头 #@rev
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
  legend: [["g", "group_prev"], ["e", "当前这一组"], ["k", "已经翻转好"], ["w", "不够 k 个，不动"]],
  presets: [
    { label: "示例 1：k = 2", args: { v: [1, 2, 3, 4, 5], k: 2 }, note: "head = [1,2,3,4,5], k = 2", expect: [2, 1, 4, 3, 5] },
    { label: "示例 2：k = 3", args: { v: [1, 2, 3, 4, 5], k: 3 }, note: "head = [1,2,3,4,5], k = 3", expect: [3, 2, 1, 4, 5] },
    { label: "8 个，k = 3", args: { v: [1, 2, 3, 4, 5, 6, 7, 8], k: 3 }, note: "head = [1,2,3,4,5,6,7,8], k = 3", expect: [3, 2, 1, 6, 5, 4, 7, 8] },
  ],
  build(a, snap) {
    const o = ["D", ...a.v], k = a.k; let p = 0, tail = false;
    const view = (lo, hi) => [{ t: "list", label: "链表（D 是哑节点）", nodes: o.map((v, i) => ({ v, cls: i === p ? "g" : i >= lo && i <= hi ? (tail ? "w" : "e") : i < p ? "k" : "" })), ptrs: { group_prev: p, kth: tail ? null : hi } }];
    snap("开始", `k = ${k}。group_prev 从哑节点 D 出发。`, view(-1, -1), { at: "init", facts: [["k", k]] });
    for (;;) {
      if (p + k >= o.length) {
        tail = true;
        snap("不够 k 个", p + 1 < o.length ? `从 group_prev 往后数，只剩 ${o.length - 1 - p} 个节点，不够 ${k} 个。这几个保持原样，结束。` : "后面没有节点了，结束。", view(p + 1, o.length - 1), { at: ["count", "done"], kind: "warn", facts: [["k", k]] });
        break;
      }
      const lo = p + 1, hi = p + k;
      snap("数出一组", `从 group_prev 往后走 ${k} 步，kth 停在 ${o[hi]}。这一组是 [${o.slice(lo, hi + 1).join(", ")}]。`, view(lo, hi), { at: "count", facts: [["k", k]] });
      const first = o[lo], seg = o.slice(lo, hi + 1).reverse();
      for (let i = 0; i < k; i++) o[lo + i] = seg[i];
      snap("组内反转并接好", `把这一组反转成 [${seg.join(", ")}]。group_prev 接上新的头 ${seg[0]}，新的尾巴 ${first} 接着后面的节点。`, view(lo, hi), { at: "rev", facts: [["k", k]] });
      p = hi;
      snap("下一组", `group_prev 移到这一组的尾巴 ${o[p]}。`, view(-1, -1), { at: "next", facts: [["k", k]] });
    }
    snap("完成", `结果是 [${o.slice(1).join(", ")}]。`, view(-1, -1), { at: "done", kind: "ok", ans: o.slice(1), facts: [["k", k]] });
  },
  points: [
    { t: "先数够再反转", body: "一定要先确认有 k 个节点。边反转边数的话，最后一组不够时还得再反转回来。" },
    { t: "先存 first 再改 group_prev.next", body: "<code>group_prev.next</code> 在改之前指着这一组原来的头，它反转后是尾巴，也是下一轮的 <code>group_prev</code>。" },
    { t: "复杂度", body: "每个节点被数一次、反转一次，时间 O(n)，空间 O(1)。" },
  ],
};
