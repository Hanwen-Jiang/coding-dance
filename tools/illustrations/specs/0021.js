module.exports = {
  id: 21, name: "合并两个有序链表", title: "合并两个有序链表图解", level: "简单", topic: "链表",
  h1: "合并两个有序链表，每次接上较小的那个",
  lede: "两个链表都已经排好序，所以最小的数一定在某个链表的头上。每次比较两个头，把小的那个接到结果后面，再让那个链表往前走一步。",
  hints: [
    { t: "每次只看两个头", body: ["两个链表各有一个指针。比较它们指向的值，小的那个就是剩下所有数里最小的。"] },
    { t: "用一个假的头节点", body: ["结果链表的第一个节点是谁，一开始不知道。", "先建一个 <code>dummy</code> 节点，所有节点都接在它后面，最后返回 <code>dummy.next</code>，这样不用单独处理第一个节点。"] },
    { t: "一个链表先走完", body: ["其中一个走完后，另一个剩下的部分已经是有序的，直接整段接上，不用再一个个比。"] },
  ],
  codes: [{ t: "标准解法：迭代 + 哑节点", code: `
class Solution:
    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
        dummy = cur = ListNode()
        while list1 and list2:
            if list1.val <= list2.val:
                cur.next, list1 = list1, list1.next
            else:
                cur.next, list2 = list2, list2.next
            cur = cur.next
        cur.next = list1 or list2       # 剩下的整段接上
        return dummy.next
` }],
  pytest: `
s = Solution()
assert toL(s.mergeTwoLists(L([1,2,4]), L([1,3,4]))) == [1,1,2,3,4,4]
assert toL(s.mergeTwoLists(L([]), L([]))) == []
assert toL(s.mergeTwoLists(L([]), L([0]))) == [0]
assert toL(s.mergeTwoLists(L([5]), L([1,2,3]))) == [1,2,3,5]
`,
  legend: [["a", "正在比较的两个头"], ["d", "已经接走"], ["k", "结果链表"]],
  presets: [
    { label: "示例 1", args: { x: [1, 2, 4], y: [1, 3, 4] }, note: "list1 = [1,2,4], list2 = [1,3,4]", expect: [1, 1, 2, 3, 4, 4] },
    { label: "长度不同", args: { x: [2, 6, 7, 9], y: [1, 3] }, note: "list1 = [2,6,7,9], list2 = [1,3]", expect: [1, 2, 3, 6, 7, 9] },
  ],
  build(a, snap) {
    const { x, y } = a, out = []; let i = 0, j = 0;
    const lv = (label, arr, p, name) => ({ t: "list", label, nodes: arr.map((v, t) => ({ v, cls: t < p ? "d" : t === p ? "a" : "" })), ptrs: { [name]: p < arr.length ? p : null } });
    const view = (done) => [lv("list1", x, i, "list1"), lv("list2", y, j, "list2"), { t: "list", label: "结果（接在 dummy 后面）", nodes: [{ v: "D", cls: "d" }, ...out.map((v) => ({ v, cls: "k" }))], showNil: !!done, ptrs: { cur: out.length } }];
    snap("开始", "两个指针分别指着两个链表的头。结果链表先只有一个哑节点 D。", view());
    while (i < x.length && j < y.length) {
      if (x[i] <= y[j]) { out.push(x[i]); snap("接上 list1 的头", `比较 ${x[i]} 和 ${y[j]}：${x[i]} ${x[i] === y[j] ? "不比它大" : "更小"}，把 list1 的 ${x[i]} 接到结果后面，list1 往前走。`, (i++, view())); }
      else { out.push(y[j]); snap("接上 list2 的头", `比较 ${x[i]} 和 ${y[j]}：${y[j]} 更小，把 list2 的 ${y[j]} 接到结果后面，list2 往前走。`, (j++, view())); }
    }
    const rest = i < x.length ? x.slice(i) : y.slice(j), which = i < x.length ? "list1" : "list2";
    out.push(...rest); i = x.length; j = y.length;
    snap("接上剩下的", rest.length ? `一个链表走完了。${which} 剩下的 [${rest.join(", ")}] 本来就有序，整段接上。` : "两个链表同时走完。", view(true));
    snap("完成", `返回 dummy.next，也就是 [${out.join(", ")}]。`, view(true), { kind: "ok", ans: out });
  },
  points: [
    { t: "返回 dummy.next", body: "<code>dummy</code> 本身只是占位用的，真正的头是它的下一个节点。" },
    { t: "相等时取哪个都行", body: "用 <code>&lt;=</code> 让相等时先取 list1 的，结果是稳定的。" },
    { t: "复杂度", body: "时间 O(m + n)，空间 O(1)，没有新建节点，只是改指针。" },
  ],
};
