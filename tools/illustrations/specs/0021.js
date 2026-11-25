const F = require("../fig");

module.exports = {
  id: 21, name: "合并两个有序链表", title: "合并两个有序链表图解", level: "简单", topic: "链表",
  h1: "合并两个有序链表，每次接上较小的那个",
  lede: "两个链表都已经排好序，所以最小的数一定在某个链表的头上。每次比较两个头，把小的那个接到结果后面，再让那个链表往前走一步。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "merge_ex1.jpg": [
      F.list([1, 2, 4], { label: "l1", cls: () => "e" }),
      F.list([1, 3, 4], { label: "l2", cls: () => "g" }),
      F.list([1, 1, 2, 3, 4, 4], { label: "合并后（颜色表示来自哪条链表）", cls: (v, i) => (i % 2 ? "g" : "e") }),
    ],
  },
  hints: [
    { t: "每次只看两个头", body: ["两个链表各有一个指针。比较它们指向的值，小的那个就是剩下所有数里最小的。"] },
    { t: "用一个假的头节点", body: ["结果链表的第一个节点是谁，一开始不知道。", "先建一个 <code>dummy</code> 节点，所有节点都接在它后面，最后返回 <code>dummy.next</code>，这样不用单独处理第一个节点。"] },
    { t: "一个链表先走完", body: ["其中一个走完后，另一个剩下的部分已经是有序的，直接整段接上，不用再一个个比。"] },
  ],
  codes: [{ t: "标准解法：迭代 + 哑节点", code: `
class Solution:
    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
        dummy = cur = ListNode()        #@init
        while list1 and list2:
            if list1.val <= list2.val:  #@take1,take2
                cur.next, list1 = list1, list1.next     #@take1
            else:                       #@take2
                cur.next, list2 = list2, list2.next     #@take2
            cur = cur.next              #@take1,take2
        cur.next = list1 or list2       # 剩下的整段接上 #@rest
        return dummy.next               #@done
` }, { t: "简洁写法：递归", key: "rec", kind: "elegant", note: "让 list1 始终指向较小的头，它的后面接上「剩下部分的合并结果」。", code: `
class Solution:
    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
        if not list1 or not list2:      #@base
            return list1 or list2       #@base
        if list1.val > list2.val:       #@pick
            list1, list2 = list2, list1 #@pick
        list1.next = self.mergeTwoLists(list1.next, list2)  #@pick,back
        return list1                    #@back
` }],
  pytest: `
s = Solution()
assert toL(s.mergeTwoLists(L([1,2,4]), L([1,3,4]))) == [1,1,2,3,4,4]
assert toL(s.mergeTwoLists(L([]), L([]))) == []
assert toL(s.mergeTwoLists(L([]), L([0]))) == [0]
assert toL(s.mergeTwoLists(L([5]), L([1,2,3]))) == [1,2,3,5]
`,
  sig: { fn: "mergeTwoLists", params: ["ListNode", "ListNode"], ret: "ListNode" },
  call: (a) => [a.x, a.y],
  cases: [[[], []], [[], [0]], [[5], [1, 2, 3]], [[1, 1], [1]]],
  method: "迭代",
  legend: [["a", "正在比较的两个头"], ["d", "已经接走 / 哑节点"], ["c", "刚接上的节点"], ["k", "结果链表"]],
  presets: [
    { label: "示例 1", args: { x: [1, 2, 4], y: [1, 3, 4] }, note: "list1 = [1,2,4], list2 = [1,3,4]", expect: [1, 1, 2, 3, 4, 4] },
    { label: "长度不同", args: { x: [2, 6, 7, 9], y: [1, 3] }, note: "list1 = [2,6,7,9], list2 = [1,3]", expect: [1, 2, 3, 6, 7, 9] },
  ],
  build(a, snap) {
    const { x, y } = a, out = [];
    let i = 0, j = 0, curIdx = 0;
    const lv = (label, arr, p, name) => ({
      t: "list",
      label,
      nodes: arr.length
        ? arr.map((v, t) => ({ v, cls: t < p ? "d" : t === p ? "a" : "" }))
        : [{ v: "∅", cls: "d", noNil: true }],
      ptrs: { [name]: p < arr.length ? p : null },
      showNil: arr.length > 0,
    });
    const view = (opts = {}) => [
      lv("list1", x, i, "list1"),
      lv("list2", y, j, "list2"),
      {
        t: "list",
        label: "结果链表（D 是哑节点，高亮箭头表示刚接上的节点）",
        nodes: [
          { v: "D", cls: "d", ...(opts.hot === 0 ? { ecls: "on" } : {}) },
          ...out.map((v, idx) => ({
            v,
            cls: opts.newFrom !== undefined && idx + 1 >= opts.newFrom ? "c" : "k",
            ...(opts.newNode === idx + 1 ? { prev: "" } : {}),
            ...(opts.hot === idx + 1 ? { ecls: "on" } : {}),
          })),
        ],
        next: Array.from({ length: out.length + 1 }, (_, k) => (k + 1 <= out.length ? k + 1 : null)),
        showNil: !!opts.done,
        ptrs: { dummy: 0, cur: curIdx },
        ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
      },
    ];
    snap(
      "初始化",
      "新建哑节点 D，cur 指向 D；list1 和 list2 分别指向两条有序链表的头节点。",
      view(),
      { at: "init", facts: [["已合并", 0]] },
    );
    while (i < x.length && j < y.length) {
      const aVal = x[i], bVal = y[j], take1 = aVal <= bVal;
      const tag = take1 ? "take1" : "take2";
      const pickVal = take1 ? aVal : bVal;
      const oldLen = out.length;
      snap(
        "比较两个头",
        `比较 list1（${aVal}）和 list2（${bVal}）：${aVal === bVal ? `一样大，优先选 list1 的 <b>${aVal}</b>` : `${take1 ? "list1" : "list2"} 的 <b>${pickVal}</b> 更小`}。`,
        view(),
        { at: tag, facts: [["比较", `${aVal} vs ${bVal}`], ["较小值", pickVal], ["已合并", oldLen]] },
      );
      out.push(pickVal);
      if (take1) i++; else j++;
      snap(
        take1 ? "接上 list1 并推进" : "接上 list2 并推进",
        `把 <b>${pickVal}</b> 接到 cur.next，同时让 ${take1 ? "list1" : "list2"} 往前走一格。`,
        view({ newFrom: out.length, newNode: out.length, hot: curIdx, animEdges: [curIdx] }),
        { at: tag, facts: [["选入", `${pickVal} (${take1 ? "list1" : "list2"})`], ["已合并", out.length, oldLen]] },
      );
      curIdx = out.length;
      snap(
        "cur = cur.next",
        `cur 前移到刚接上的节点 <b>${pickVal}</b>，准备下一次比较。`,
        view(),
        { at: tag, facts: [["已合并", out.length]] },
      );
    }
    const rest = i < x.length ? x.slice(i) : y.slice(j), which = i < x.length ? "list1" : "list2";
    const prevLen = out.length;
    out.push(...rest);
    i = x.length;
    j = y.length;
    snap(
      "接上剩下的",
      rest.length
        ? `另一条链表走完了。${which} 剩下的 [${rest.join(", ")}] 本来就有序，让 cur.next 直接整段接上。`
        : "两条链表同时走完，没有剩余节点。",
      view(rest.length ? { done: true, newFrom: prevLen + 1, hot: curIdx, animEdges: [curIdx] } : { done: true }),
      {
        at: "rest",
        facts: rest.length
          ? [["剩余整段", `[${rest.join(", ")}]`], ["已合并", out.length, prevLen]]
          : [["已合并", out.length]],
      },
    );
    curIdx = out.length;
    snap("完成", `返回 dummy.next，合并结果是 [${out.join(", ")}]。`, view({ done: true }), { at: "done", kind: "ok", ans: out.slice(), facts: [["已合并", out.length]] });
  },
  alts: [{
    t: "递归",
    code: "rec",
    note: "和简洁写法一样：每一层选出两个头里较小的那个，它后面接什么要等下一层合并完剩下的部分。所以选是从前往后选，接是从后往前接。",
    legend: [["a", "正在比较的两个头"], ["d", "已经被某一层选走"], ["e", "调用栈"], ["c", "刚接回的节点"], ["k", "已经接好的部分"]],
    build(a, snap) {
      const { x, y } = a, calls = [];
      let i = 0, j = 0, tail = [];
      const lv = (label, arr, p, name) => ({
        t: "list",
        label,
        nodes: arr.length
          ? arr.map((v, t) => ({ v, cls: t < p ? "d" : t === p ? "a" : "" }))
          : [{ v: "∅", cls: "d", noNil: true }],
        ptrs: { [name]: p < arr.length ? p : null },
        showNil: arr.length > 0,
      });
      const view = (opts = {}) => [
        lv("list1", x, i, "list1"),
        lv("list2", y, j, "list2"),
        {
          t: "chips",
          label: "递归调用栈（右边是最里层；写的是这一层选中的节点）",
          items: calls.map((v, t) => ({ v: `选了 ${v}`, cls: t === calls.length - 1 ? "a" : "e" })),
          empty: "空",
        },
        {
          t: "list",
          label: "已经接好的部分（回溯时从后往前连起来）",
          nodes: tail.length
            ? tail.map((v, idx) => ({
                v,
                cls: opts.hotHead && idx === 0 ? "c" : "k",
                ...(opts.hotHead && idx === 0 ? { prev: "", ecls: "on" } : {}),
              }))
            : [{ v: "∅", cls: "d", noNil: true }],
          next: tail.length ? Array.from({ length: tail.length }, (_, idx) => (idx + 1 < tail.length ? idx + 1 : null)) : [null],
          showNil: tail.length > 0,
          ptrs: opts.hotHead && tail.length ? { list1: 0 } : {},
          ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
        },
      ];
      snap("开始", "每一层只做一件事：两个头里挑小的，它的 next 等于「剩下部分的合并结果」。", view(), { at: [], facts: [["调用栈深度", 0]] });
      while (i < x.length && j < y.length) {
        const eq = x[i] === y[j], fromX = x[i] <= y[j], pick = fromX ? x[i] : y[j], cmp = `${x[i]} 和 ${y[j]}`;
        const prevDepth = calls.length;
        calls.push(pick);
        if (fromX) i++; else j++;
        snap(
          "递归进入",
          `比较两个头 ${cmp}，` + (eq ? `一样大，取 list1 的 ${pick}` : `${fromX ? "list1" : "list2"} 的 ${pick} 更小`) + `。这一层记住 <b>${pick}</b>，它后面接什么交给下一层去合并。`,
          view(),
          { at: "pick", facts: [["选中", pick], ["调用栈深度", calls.length, prevDepth]] },
        );
      }
      tail = i < x.length ? x.slice(i) : y.slice(j);
      const which = i < x.length ? "list2" : "list1";
      i = x.length;
      j = y.length;
      snap(
        "到底",
        tail.length ? `${which} 已经空了，这一层直接返回另一条剩下的 [${tail.join(", ")}]。` : "两条链表都空了，返回空。",
        view(),
        { at: "base", facts: [["调用栈深度", calls.length], ["已接长度", tail.length]] },
      );
      while (calls.length) {
        const v = calls[calls.length - 1], old = tail.slice();
        tail = [v, ...tail];
        snap(
          "回溯接上",
          `回到选了 <b>${v}</b> 的这一层：让 ${v}.next 接上下一层返回的${old.length ? ` [${old.join(", ")}]` : "空链表"}，再把 ${v} 返回给上一层。`,
          view({ hotHead: true, animEdges: old.length ? [0] : [] }),
          { at: "back", facts: [["调用栈深度", calls.length], ["已接长度", tail.length, old.length]] },
        );
        calls.pop();
      }
      snap("完成", `递归全部返回，最终链表是 [${tail.join(", ")}]。`, view(), { at: "back", kind: "ok", ans: tail.slice(), facts: [["调用栈深度", 0], ["已接长度", tail.length]] });
    },
  }],
  points: [
    { t: "返回 dummy.next", body: "<code>dummy</code> 本身只是占位用的，真正的头是它的下一个节点。" },
    { t: "相等时取哪个都行", body: "用 <code>&lt;=</code> 让相等时先取 list1 的，结果是稳定的。" },
    { t: "复杂度", body: "时间 O(m + n)，空间 O(1)，没有新建节点，只是改指针。" },
  ],
};
