module.exports = {
  slug: "linked-list", name: "链表", kind: "ds", order: 3,
  lede: "链表的节点散在内存各处，每个节点记着下一个节点在哪。好处是插入、删除只改一两个指针；代价是不能按下标直接访问，只能从头一个个往后走。写链表题最常用的两个技巧：哑节点和快慢指针。",
  related: [206, 21, 2, 19, 24, 141, 142, 160, 234, 148, 25, 23],
  sections: [{
    key: "build", t: "定义和构造",
    body: [
      "一个节点就是一个小对象：<code>val</code> 存值，<code>next</code> 指向下一个节点，最后一个节点的 <code>next</code> 是空。力扣已经把 <code>ListNode</code> 定义好了（代码开头的注释就是它的定义），题目给你的是头节点 <code>head</code>。",
      "从数组建链表时用<b>尾插法</b>：记住当前的尾巴 <code>tail</code>，每来一个数就新建节点接在 tail 后面，再把 tail 挪到新节点。开头先放一个<b>哑节点</b>（dummy），这样第一个节点和后面的节点处理方式完全一样，不用单独判断「链表还是空的」。",
    ],
    points: [
      { t: "返回 dummy.next", body: "哑节点只是个占位的，真正的头节点是它的下一个。数组为空时 <code>dummy.next</code> 正好是空。" },
      { t: "Go 里用指针", body: "Go 的节点要写成 <code>&amp;ListNode{Val: x}</code>，变量都是 <code>*ListNode</code>，不然改的是副本。" },
    ],
    codes: [{ t: "尾插法", key: "build", code: `
# 力扣已经定义好了 ListNode：
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next

class Solution:
    def buildList(self, nums: List[int]) -> Optional[ListNode]:
        dummy = ListNode()              # 哑节点：省掉「链表还是空的」这个特殊情况 #@init
        tail = dummy                    #@init
        for x in nums:                  #@loop
            tail.next = ListNode(x)     # 新建节点，接到尾巴后面 #@link
            tail = tail.next            # 尾巴往后挪 #@move
        return dummy.next               # 真正的头是哑节点的下一个 #@done
` }],
    sig: { fn: "buildList", params: ["int[]"], ret: "ListNode" },
    call: (a) => [a.nums],
    cases: [[[]], [[7]], [[1, 2, 3, 4, 5]]],
    gen: (R) => { const nums = R.arr(R.int(1, 6), 0, 9); return { args: { nums }, note: `nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["g", "哑节点"], ["a", "刚接上的节点"], ["e", "已经在链表里"]],
      presets: [{ label: "示例", args: { nums: [1, 2, 3, 4] }, note: "nums = [1,2,3,4]", expect: [1, 2, 3, 4] }],
      build(a, snap) {
        const nums = a.nums, nodes = [{ v: "D", cls: "g" }];
        let tail = 0, fresh = -1;
        const view = () => [
          { t: "array", label: "nums", items: nums.map((v, i) => ({ v, cls: i < nodes.length - 1 ? "d" : "" })) },
          { t: "list", label: "链表（D 是哑节点）", nodes: nodes.map((nd, i) => ({ ...nd, cls: i === 0 ? "g" : i === fresh ? "a" : "e" })), ptrs: { dummy: 0, tail } },
        ];
        snap("开始", "先放一个哑节点 D，tail 指着它。现在链表里还没有真正的节点。", view(), { at: "init" });
        for (const x of nums) {
          nodes.push({ v: x }); fresh = nodes.length - 1;
          snap("接上新节点", `新建值为 ${x} 的节点，让 tail.next 指向它。`, view(), { at: ["loop", "link"] });
          tail = fresh;
          snap("尾巴后移", `tail 挪到新节点 ${x} 上，下一个节点就接在它后面。`, view(), { at: "move" });
        }
        fresh = -1;
        snap("完成", nums.length ? `返回 dummy.next，也就是节点 ${nums[0]}。` : "数组是空的，dummy.next 是空，返回空链表。", view(), { at: "done", kind: "ok", ans: nums.slice() });
      },
    },
  }, {
    key: "dummy", t: "哑节点：删除节点",
    body: [
      "单链表删除节点要改它<b>前一个</b>节点的 <code>next</code>：<code>prev.next = prev.next.next</code>，被跳过的节点就不在链表里了。所以遍历时让 <code>cur</code> 停在「要检查的节点」前面一格，看的是 <code>cur.next</code>。",
      "麻烦在头节点：它前面没有节点。在头前面接一个哑节点，头节点就也有了「前一个」，删头和删中间写法一样，最后返回 <code>dummy.next</code>。凡是头节点可能被删掉、被换掉的题（删除倒数第 N 个、合并、两两交换…）都可以先放一个哑节点。",
    ],
    points: [
      { t: "删完不要急着往后走", body: "删掉 <code>cur.next</code> 之后，新的 <code>cur.next</code> 还没检查过，所以这一轮 <code>cur</code> 不动。" },
      { t: "C++ 里记得释放", body: "力扣不检查内存，演示代码里没有 <code>delete</code>；自己的项目里删掉的节点要释放。" },
    ],
    codes: [{ t: "哑节点", key: "dummy", code: `
class Solution:
    def removeElements(self, head: Optional[ListNode], val: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)       # 头节点前面也有一个节点了 #@init
        cur = dummy                     #@init
        while cur.next:                 # 检查的是 cur 的下一个节点 #@check
            if cur.next.val == val:     #@check
                cur.next = cur.next.next    # 跳过它，就把它删掉了 #@del
            else:                       #@keep
                cur = cur.next          #@keep
        return dummy.next               #@done
` }],
    sig: { fn: "removeElements", params: ["ListNode", "int"], ret: "ListNode" },
    call: (a) => [a.nums, a.val],
    cases: [[[], 1], [[7, 7, 7, 7], 7], [[1, 2, 6, 3, 4, 5, 6], 6]],
    gen: (R) => { const nums = R.arr(R.int(0, 7), 1, 4), val = R.int(1, 4); return { args: { nums, val }, note: `head = ${R.fmt(nums)}, val = ${val}` }; },
    demo: {
      legend: [["g", "哑节点"], ["a", "正在检查 cur.next"], ["d", "已经删掉"]],
      presets: [
        { label: "示例 1", args: { nums: [1, 2, 6, 3, 4, 5, 6], val: 6 }, note: "head = [1,2,6,3,4,5,6], val = 6", expect: [1, 2, 3, 4, 5] },
        { label: "删头节点", args: { nums: [7, 7, 1, 7], val: 7 }, note: "head = [7,7,1,7], val = 7", expect: [1] },
      ],
      build(a, snap) {
        const v = ["D", ...a.nums], n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : null)), gone = new Set();
        let cur = 0, look = null;
        const view = () => [{ t: "list", label: "链表（D 是哑节点）", nodes: v.map((x, i) => ({ v: x, cls: i === 0 ? "g" : gone.has(i) ? "d" : i === look ? "a" : "", noNil: gone.has(i) })), next: next.slice(), ptrs: { cur } }];
        snap("开始", `在头节点前面接一个哑节点 D，cur 从 D 开始。要删掉所有值为 ${a.val} 的节点。`, view(), { at: "init" });
        while (next[cur] !== null) {
          look = next[cur];
          if (v[look] === a.val) {
            snap("检查", `cur.next 的值是 ${v[look]}，等于 ${a.val}，要删掉。`, view(), { at: "check" });
            next[cur] = next[look]; next[look] = null; gone.add(look); look = null;
            snap("删除", `cur.next = cur.next.next：${v[cur]} 直接指向${next[cur] === null ? "空" : " " + v[next[cur]]}，被跳过的节点就不在链表里了。cur 不动，接着检查新的 cur.next。`, view(), { at: "del" });
          } else {
            snap("检查", `cur.next 的值是 ${v[look]}，不用删。`, view(), { at: "check" });
            cur = look; look = null;
            snap("往后走", `cur 挪到 ${v[cur]}。`, view(), { at: "keep" });
          }
        }
        const out = [];
        for (let i = next[0]; i !== null; i = next[i]) out.push(v[i]);
        snap("完成", `cur.next 是空，检查完了。返回 dummy.next：${out.length ? out.join(" → ") : "空链表"}。`, view(), { at: "done", kind: "ok", ans: out });
      },
    },
  }, {
    key: "fast-slow", t: "快慢指针：找中点",
    body: [
      "两个指针从头出发，<code>slow</code> 每次走一步，<code>fast</code> 每次走两步。fast 走到头时，slow 正好走了一半，停在中点。这样一趟就找到中点，不用先数长度。",
      "同样的思路还能判断链表有没有环（141、142：有环时 fast 一定会追上 slow）、找倒数第 k 个节点（19：让 fast 先走 k 步，再一起走）。",
    ],
    points: [
      { t: "循环条件", body: "<code>fast and fast.next</code>：fast 要能再走两步。偶数个节点时 slow 停在两个中点的第二个，正是力扣 876 要的。" },
      { t: "想要第一个中点", body: "排序链表（148）拆成两半时要第一个中点，可以让 fast 从 <code>head.next</code> 出发。" },
    ],
    codes: [{ t: "快慢指针", key: "fast-slow", code: `
class Solution:
    def middleNode(self, head: Optional[ListNode]) -> Optional[ListNode]:
        slow = fast = head              #@init
        while fast and fast.next:       # fast 还能再走两步 #@loop
            slow = slow.next            # 慢指针走一步 #@step
            fast = fast.next.next       # 快指针走两步 #@step
        return slow                     # fast 到头时 slow 在中间 #@done
` }],
    sig: { fn: "middleNode", params: ["ListNode"], ret: "ListNode" },
    call: (a) => [a.nums],
    cases: [[[1]], [[1, 2]], [[1, 2, 3, 4, 5]], [[1, 2, 3, 4, 5, 6]]],
    gen: (R) => { const nums = R.arr(R.int(1, 8), 1, 9); return { args: { nums }, note: `head = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["a", "slow"], ["b", "fast"], ["c", "中点"]],
      presets: [
        { label: "奇数个", args: { nums: [1, 2, 3, 4, 5] }, note: "head = [1,2,3,4,5]", expect: [3, 4, 5] },
        { label: "偶数个", args: { nums: [1, 2, 3, 4, 5, 6] }, note: "head = [1,2,3,4,5,6]", expect: [4, 5, 6] },
      ],
      build(a, snap) {
        const v = a.nums, n = v.length;
        let slow = 0, fast = 0, done = false;
        const view = () => [{ t: "list", label: "链表", nodes: v.map((x, i) => ({ v: x, cls: done && i === slow ? "c" : i === fast && fast < n ? "b" : i === slow ? "a" : "" })), ptrs: { slow, ...(fast < n ? { fast } : {}) } }];
        snap("开始", "slow 和 fast 都从头节点出发。", view(), { at: "init" });
        while (fast < n && fast + 1 < n) {
          slow += 1; fast += 2;
          snap("各走一步 / 两步", `fast 后面还有节点，slow 走一步到 ${v[slow]}，fast 走两步到${fast < n ? " " + v[fast] : "空"}。`, view(), { at: ["loop", "step"] });
        }
        done = true;
        snap("完成", `${fast < n ? "fast 是最后一个节点" : "fast 走到了空"}，不能再走两步了。slow 停在 ${v[slow]}，就是中点。`, view(), { at: ["loop", "done"], kind: "ok", ans: v.slice(slow) });
      },
    },
  }],
};
