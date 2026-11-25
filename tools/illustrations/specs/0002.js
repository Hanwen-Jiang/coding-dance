const F = require("../fig");

module.exports = {
  id: 2, name: "两数相加", title: "两数相加图解", level: "中等", topic: "链表",
  h1: "两数相加，像列竖式一样从个位加起",
  lede: "链表是逆序存的，头节点就是个位，这正好是做加法的顺序。两个链表同时往后走，每一位相加再加上进位，写下个位数，把进位带到下一位。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "addtwonumber1.jpg": [
      F.list([2, 4, 3], { label: "l1：342 的各位倒着存", cls: () => "e" }),
      F.list([5, 6, 4], { label: "l2：465 的各位倒着存", cls: () => "g" }),
      F.list([7, 0, 8], { label: "结果：342 + 465 = 807，同样倒着存", cls: () => "k" }),
    ],
  },
  hints: [
    { t: "逆序是好事", body: ["<code>2 → 4 → 3</code> 表示 342，头节点是个位。", "加法本来就是从个位开始算，所以直接从头往后走就行，不用反转。"] },
    { t: "每一位怎么算", body: ["<code>total = 这一位的两个数 + 进位</code>。", "结果的这一位是 <code>total % 10</code>，新的进位是 <code>total // 10</code>。"] },
    { t: "两个容易漏的地方", body: ["两个链表长度不同：短的走完后，缺的那一位当作 0。", "最后还有进位：两个链表都走完了但进位是 1，要再补一个节点。把 <code>carry</code> 也写进循环条件就能一起处理。"] },
  ],
  codes: [{ t: "标准解法：模拟竖式加法", code: `
class Solution:
    def addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:
        dummy = cur = ListNode()        #@init
        carry = 0                       #@init
        while l1 or l2 or carry:
            total = carry               #@add
            if l1:
                total += l1.val         #@add
                l1 = l1.next            #@add
            if l2:
                total += l2.val         #@add
                l2 = l2.next            #@add
            carry, digit = divmod(total, 10)    #@digit
            cur.next = ListNode(digit)  #@digit
            cur = cur.next              #@digit
        return dummy.next               #@done
` }, { t: "简洁写法：递归，进位当参数", kind: "elegant", note: "把进位当成第三个参数往下传。两条链表都走完、也没有进位时结束。", code: `
class Solution:
    def addTwoNumbers(self, l1, l2, carry=0):
        if not l1 and not l2 and not carry:
            return None
        s = (l1.val if l1 else 0) + (l2.val if l2 else 0) + carry
        return ListNode(s % 10, self.addTwoNumbers(l1 and l1.next, l2 and l2.next, s // 10))
` }],
  pytest: `
s = Solution()
assert toL(s.addTwoNumbers(L([2,4,3]), L([5,6,4]))) == [7,0,8]
assert toL(s.addTwoNumbers(L([0]), L([0]))) == [0]
assert toL(s.addTwoNumbers(L([9,9,9,9,9,9,9]), L([9,9,9,9]))) == [8,9,9,9,0,0,0,1]
`,
  sig: { fn: "addTwoNumbers", params: ["ListNode", "ListNode"], ret: "ListNode" },
  call: (a) => [a.x, a.y],
  cases: [[[0], [0]], [[9, 9, 9, 9, 9, 9, 9], [9, 9, 9, 9]], [[5], [5]]],
  legend: [["a", "正在相加的这一位"], ["d", "已经加过 / 哑节点"], ["c", "刚新建的节点"], ["k", "结果链表"]],
  presets: [
    { label: "示例 1", args: { x: [2, 4, 3], y: [5, 6, 4] }, note: "l1 = [2,4,3], l2 = [5,6,4]（342 + 465）", expect: [7, 0, 8] },
    { label: "长度不同 + 最后进位", args: { x: [9, 9, 9, 9], y: [9, 9] }, note: "l1 = [9,9,9,9], l2 = [9,9]（9999 + 99）", expect: [8, 9, 0, 0, 1] },
  ],
  build(a, snap) {
    const { x, y } = a, out = [];
    let i = 0, p1 = 0, p2 = 0, carry = 0, curIdx = 0;
    const lv = (label, arr, ptr, name, activeIdx) => ({
      t: "list",
      label,
      nodes: arr.length
        ? arr.map((v, t) => ({ v, cls: t < ptr ? "d" : t === activeIdx ? "a" : "" }))
        : [{ v: "∅", cls: "d", noNil: true }],
      ptrs: { [name]: ptr < arr.length ? ptr : null },
      showNil: arr.length > 0,
    });
    const view = (opts = {}) => [
      lv("l1（头节点是个位）", x, p1, "l1", opts.active1),
      lv("l2（头节点是个位）", y, p2, "l2", opts.active2),
      {
        t: "list",
        label: "结果链表（D 是哑节点，高亮箭头表示刚接上的新节点）",
        nodes: [
          { v: "D", cls: "d", ...(opts.hot === 0 ? { ecls: "on" } : {}) },
          ...out.map((v, idx) => ({
            v,
            cls: opts.newNode === idx + 1 ? "c" : "k",
            ...(opts.newNode === idx + 1 ? { prev: "" } : {}),
            ...(opts.hot === idx + 1 ? { ecls: "on" } : {}),
          })),
        ],
        next: Array.from({ length: out.length + 1 }, (_, k) => (k + 1 <= out.length ? k + 1 : null)),
        ptrs: { dummy: 0, cur: curIdx },
        ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
        showNil: !!opts.done,
      },
    ];
    snap(
      "初始化",
      "新建哑节点 D，cur 指向 D；l1 和 l2 分别停在两个链表的个位（头节点），进位 carry = 0。",
      view(),
      { at: "init", facts: [["进位 carry", 0]] },
    );
    while (i < x.length || i < y.length || carry) {
      const has1 = i < x.length, has2 = i < y.length;
      const p = has1 ? x[i] : 0, q = has2 ? y[i] : 0;
      const oldCarry = carry, total = p + q + oldCarry;
      const tailOnly = !has1 && !has2;
      const parts = [has1 ? String(p) : "0（l1 已空）", has2 ? String(q) : "0（l2 已空）"];
      snap(
        tailOnly ? "只剩最后进位" : "读取并相加",
        tailOnly
          ? `l1 和 l2 都走完了，只剩进位 ${oldCarry}，所以 total = <b>${total}</b>。`
          : `取出当前位：${parts[0]} + ${parts[1]} + 进位 ${oldCarry} = <b>${total}</b>。`,
        view({ active1: has1 ? i : -1, active2: has2 ? i : -1 }),
        { at: "add", facts: [["进位 carry", oldCarry], ["当前和 total", total]] },
      );
      if (!tailOnly) {
        if (has1) p1++;
        if (has2) p2++;
        snap(
          "l1、l2 指针前移",
          `这一位的数字已经加进 total（${total}），把 ${[has1 && "l1", has2 && "l2"].filter(Boolean).join(" 和 ")} 往后移一格。`,
          view(),
          { at: "add", facts: [["进位 carry", oldCarry], ["当前和 total", total]] },
        );
      }
      carry = Math.floor(total / 10);
      const digit = total % 10;
      out.push(digit);
      snap(
        "新建节点并接上",
        `${total} ÷ 10：写下个位 <b>${digit}</b>，新的进位是 <b>${carry}</b>。新建节点 ${digit}，让 cur.next 指向它。`,
        view({ newNode: out.length, hot: curIdx, animEdges: [curIdx] }),
        { at: "digit", facts: [["进位 carry", carry, oldCarry], ["当前位 digit", digit], ["当前和 total", total]] },
      );
      curIdx = out.length;
      snap(
        "cur = cur.next",
        `cur 前移到刚接上的节点 <b>${digit}</b>，准备处理下一位。`,
        view(),
        { at: "digit", facts: [["进位 carry", carry]] },
      );
      i++;
    }
    snap(
      "完成",
      `两条链表都走完，进位也归 0。返回 dummy.next，结果是 [${out.join(", ")}]（表示 ${out.slice().reverse().join("")}）。`,
      view({ done: true }),
      { at: "done", kind: "ok", ans: out.slice(), facts: [["进位 carry", 0]] },
    );
  },
  points: [
    { t: "循环条件带上 carry", body: "<code>while l1 or l2 or carry</code>：最后多出来的进位也能在循环里处理，不用在外面补。" },
    { t: "不要转成整数再加", body: "链表最长 100 位，超出了普通整数范围。Python 虽然不会溢出，但这不是题目想考的。" },
    { t: "复杂度", body: "时间 O(max(m, n))，结果链表最多比长的那个多一位。" },
  ],
};
