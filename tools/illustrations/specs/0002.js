module.exports = {
  id: 2, name: "两数相加", title: "两数相加图解", level: "中等", topic: "链表",
  h1: "两数相加，像列竖式一样从个位加起",
  lede: "链表是逆序存的，头节点就是个位，这正好是做加法的顺序。两个链表同时往后走，每一位相加再加上进位，写下个位数，把进位带到下一位。",
  hints: [
    { t: "逆序是好事", body: ["<code>2 → 4 → 3</code> 表示 342，头节点是个位。", "加法本来就是从个位开始算，所以直接从头往后走就行，不用反转。"] },
    { t: "每一位怎么算", body: ["<code>total = 这一位的两个数 + 进位</code>。", "结果的这一位是 <code>total % 10</code>，新的进位是 <code>total // 10</code>。"] },
    { t: "两个容易漏的地方", body: ["两个链表长度不同：短的走完后，缺的那一位当作 0。", "最后还有进位：两个链表都走完了但进位是 1，要再补一个节点。把 <code>carry</code> 也写进循环条件就能一起处理。"] },
  ],
  codes: [{ t: "标准解法：模拟竖式加法", code: `
class Solution:
    def addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:
        dummy = cur = ListNode()
        carry = 0
        while l1 or l2 or carry:
            total = carry
            if l1:
                total += l1.val
                l1 = l1.next
            if l2:
                total += l2.val
                l2 = l2.next
            carry, digit = divmod(total, 10)
            cur.next = ListNode(digit)
            cur = cur.next
        return dummy.next
` }],
  pytest: `
s = Solution()
assert toL(s.addTwoNumbers(L([2,4,3]), L([5,6,4]))) == [7,0,8]
assert toL(s.addTwoNumbers(L([0]), L([0]))) == [0]
assert toL(s.addTwoNumbers(L([9,9,9,9,9,9,9]), L([9,9,9,9]))) == [8,9,9,9,0,0,0,1]
`,
  legend: [["a", "正在相加的这一位"], ["d", "已经加过"], ["k", "结果"]],
  presets: [
    { label: "示例 1", args: { x: [2, 4, 3], y: [5, 6, 4] }, note: "l1 = [2,4,3], l2 = [5,6,4]（342 + 465）", expect: [7, 0, 8] },
    { label: "长度不同 + 最后进位", args: { x: [9, 9, 9, 9], y: [9, 9] }, note: "l1 = [9,9,9,9], l2 = [9,9]（9999 + 99）", expect: [8, 9, 0, 0, 1] },
  ],
  build(a, snap) {
    const { x, y } = a, out = []; let i = 0, carry = 0;
    const lv = (label, arr) => ({ t: "list", label, nodes: arr.map((v, t) => ({ v, cls: t < i ? "d" : t === i ? "a" : "" })) });
    const view = (done) => [lv("l1（头节点是个位）", x), lv("l2", y), { t: "list", label: "结果", nodes: out.length ? out.map((v) => ({ v, cls: "k" })) : [{ v: "", cls: "d" }], showNil: !!done }];
    snap("开始", "两个指针都在个位，进位是 0。", view(), { facts: [["进位", 0]] });
    while (i < x.length || i < y.length || carry) {
      const p = i < x.length ? x[i] : 0, q = i < y.length ? y[i] : 0, total = p + q + carry, old = carry;
      const parts = [i < x.length ? String(p) : "0（l1 已走完）", i < y.length ? String(q) : "0（l2 已走完）"];
      carry = Math.floor(total / 10); out.push(total % 10);
      snap(i >= x.length && i >= y.length ? "补上最后的进位" : "加这一位", `${parts[0]} + ${parts[1]} + 进位 ${old} = <b>${total}</b>。写下 ${total % 10}，进位 ${carry}。`, view(), { facts: [["进位", carry], ["这一位的和", total]] });
      i++;
    }
    snap("完成", `两个链表都走完，进位也是 0。结果是 [${out.join(", ")}]，也就是 ${out.slice().reverse().join("")}。`, view(true), { kind: "ok", ans: out, facts: [["进位", 0]] });
  },
  points: [
    { t: "循环条件带上 carry", body: "<code>while l1 or l2 or carry</code>：最后多出来的进位也能在循环里处理，不用在外面补。" },
    { t: "不要转成整数再加", body: "链表最长 100 位，超出了普通整数范围。Python 虽然不会溢出，但这不是题目想考的。" },
    { t: "复杂度", body: "时间 O(max(m, n))，结果链表最多比长的那个多一位。" },
  ],
};
