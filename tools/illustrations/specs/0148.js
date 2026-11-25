const F = require("../fig");

module.exports = {
  id: 148, name: "排序链表", title: "排序链表图解", level: "中等", topic: "链表",
  h1: "排序链表，对半拆到底再两两合并",
  lede: "链表不能按下标随机访问，快排和堆排都不好用，归并排序最合适：用快慢指针从中间断开，两半各自排好，再用「合并两个有序链表」把它们合起来。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "sort_list_1.jpg": [F.row([F.list([4, 2, 1, 3]), F.list([1, 2, 3, 4], { cls: () => "k" })], { label: "升序排列" })],
    "sort_list_2.jpg": [F.row([F.list([-1, 5, 3, 4, 0]), F.list([-1, 0, 3, 4, 5], { cls: () => "k" })], { label: "升序排列" })],
  },
  hints: [
    { t: "为什么选归并", body: ["题目要求 <code>O(n log n)</code>。归并排序只需要顺序访问，而且合并两个有序链表不需要额外数组，很适合链表。"] },
    { t: "怎么从中间断开", body: ["快慢指针找中点：<code>slow</code> 走一步，<code>fast</code> 走两步。", "<code>fast</code> 到头时 <code>slow</code> 在前半段的最后一个节点，把 <code>slow.next</code> 置空，链表就断成了两半。"] },
    { t: "递归的三步", body: ["一、只有 0 或 1 个节点时已经有序，直接返回。", "二、断成两半，分别递归排序。", "三、把两个排好序的链表合并（21 题）。"] },
  ],
  codes: [{ t: "标准解法：自顶向下归并排序", code: `
class Solution:
    def sortList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if not head or not head.next:   #@base
            return head                 #@base
        slow, fast = head, head.next    # fast 先走一步，slow 停在前半段末尾 #@mid
        while fast and fast.next:       #@mid
            slow, fast = slow.next, fast.next.next  #@mid
        mid, slow.next = slow.next, None    # 从中间断开 #@cut
        left, right = self.sortList(head), self.sortList(mid)   #@rec
        dummy = cur = ListNode()        #@merge
        while left and right:           # 合并两个有序链表 #@merge
            if left.val <= right.val:   #@merge
                cur.next, left = left, left.next    #@merge
            else:
                cur.next, right = right, right.next #@merge
            cur = cur.next              #@merge
        cur.next = left or right        #@merge
        return dummy.next               #@merge,done
` }, { t: "简洁写法：取出值排序再写回", kind: "elegant", note: "实际运行最快，但用了 O(n) 额外空间，也没有考到链表操作，面试时只能当作开场。", code: `
class Solution:
    def sortList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        vals, node = [], head
        while node:
            vals.append(node.val)
            node = node.next
        node = head
        for v in sorted(vals):
            node.val = v
            node = node.next
        return head
` }],
  pytest: `
s = Solution()
assert toL(s.sortList(L([4,2,1,3]))) == [1,2,3,4]
assert toL(s.sortList(L([-1,5,3,4,0]))) == [-1,0,3,4,5]
assert toL(s.sortList(L([]))) == []
for _ in range(200):
    a = [random.randint(-9, 9) for _ in range(random.randint(0, 20))]
    assert toL(s.sortList(L(a))) == sorted(a)
`,
  sig: { fn: "sortList", params: ["ListNode"], ret: "ListNode" },
  call: (a) => [a.v],
  cases: [[[]], [[1]], [[2, 1]], [[5, -3, 5, 0, -100000, 100000, 7, 7, 1]]],
  legend: [["a", "slow / left / 当前段"], ["b", "fast / right"], ["e", "刚拆出的两半"], ["k", "已排好序"]],
  presets: [
    { label: "示例 1", args: { v: [4, 2, 1, 3] }, note: "head = [4,2,1,3]", expect: [1, 2, 3, 4] },
    { label: "示例 2", args: { v: [-1, 5, 3, 4, 0] }, note: "head = [-1,5,3,4,0]", expect: [-1, 0, 3, 4, 5] },
  ],
  build(a, snap) {
    const f = (s) => `[${s.join(", ")}]`;
    if (!a.v.length) {
      snap("空链表", "链表为空，直接返回空。", [{ t: "note", label: "链表", html: "空" }], { at: "base", kind: "ok", ans: [] });
      return;
    }
    const segs = [a.v.slice()];
    const segStart = (idx) => {
      let off = 0;
      for (let k = 0; k < idx; k++) off += segs[k].length;
      return off;
    };
    const view = (opts = {}) => {
      const nodes = [];
      const next = [];
      let g = 0;
      segs.forEach((s, si) => {
        s.forEach((val, j) => {
          const isEnd = j === s.length - 1;
          let cls = (opts.clsAtSeg && opts.clsAtSeg[si]) || "";
          if (opts.doneRange) {
            for (const [lo, hi] of opts.doneRange) {
              if (g >= lo && g < hi) cls = "d";
            }
          }
          nodes.push({
            v: val,
            cls,
            ...(isEnd && opts.showNilAt !== g && si < segs.length - 1 ? { noNil: true } : {}),
            ...(opts.hotEdges && opts.hotEdges.includes(g) ? { ecls: "on" } : {}),
          });
          next.push(isEnd ? null : g + 1);
          g++;
        });
      });
      const views = [{
        t: "list",
        label: "链表（虚红线 × 表示断开指针；每段各自用 next 连成小段）",
        nodes,
        next: next.slice(),
        ptrs: opts.ptrs || {},
        ...(opts.ghostEdges ? { ghostEdges: opts.ghostEdges.slice() } : {}),
        ...(opts.animEdges ? { animEdges: opts.animEdges.slice() } : {}),
      }];
      if (opts.merging) {
        const m = opts.merging;
        views.push({
          t: "list",
          label: "合并中的新链表（dummy.next ...）",
          nodes: m.length
            ? m.map((x, idx) => ({
              v: x,
              cls: idx === m.length - 1 ? "k" : "e",
              ...(idx === m.length - 2 ? { ecls: "on" } : {}),
            }))
            : [{ v: "空", cls: "d" }],
          next: m.length ? m.map((_, idx) => (idx + 1 < m.length ? idx + 1 : null)) : [null],
          showNil: m.length > 0,
          ...(m.length >= 2 ? { animEdges: [m.length - 2] } : {}),
        });
      }
      views.push({
        t: "chips",
        label: "当前的各段（从左到右）",
        items: segs.map((s, i) => ({ v: f(s), cls: (opts.segMark && opts.segMark[i]) || "" })),
      });
      return views;
    };

    if (a.v.length === 1) {
      snap("单节点已有序", `链表只有 1 个节点 ${f(a.v)}，不需要拆分，直接返回。`, view({ segMark: { 0: "k" }, clsAtSeg: { 0: "k" } }), {
        at: "base",
        kind: "ok",
        ans: a.v.slice(),
        facts: [["段数", 1]],
      });
      return;
    }

    snap("开始归并排序", `整个链表 ${f(a.v)} 有 ${a.v.length} 个节点，需要不断从中间断开再合并。`, view({ segMark: { 0: "a" } }), {
      at: "base",
      facts: [["当前段", f(a.v)], ["段数", 1]],
    });

    const sort = (i) => {
      const s = segs[i];
      if (s.length <= 1) {
        snap("单节点已有序", `${f(s)} 只有 1 个节点，满足基准条件，直接返回。`, view({ segMark: { [i]: "k" }, clsAtSeg: { [i]: "k" } }), {
          at: "base",
          facts: [["当前段", f(s)], ["段数", segs.length]],
        });
        return;
      }
      const off = segStart(i);
      let slow = 0, fast = 1;
      snap("slow, fast = head, head.next", `对 ${f(s)} 找中点：slow 从 ${s[slow]} 出发，fast 从 ${s[fast]} 出发（先走一步）。`, view({
        segMark: { [i]: "a" },
        clsAtSeg: { [i]: "a" },
        ptrs: { slow: off + slow, fast: off + fast },
      }), {
        at: "mid",
        facts: [["当前段", f(s)], ["段数", segs.length]],
      });
      while (fast + 1 < s.length) {
        const prevS = slow;
        slow += 1;
        fast = fast + 2 < s.length ? fast + 2 : null;
        snap("快慢指针找中点", `slow 走 1 步到 <b>${s[slow]}</b>，fast 走 2 步${fast === null ? "走到了空" : `到 <b>${s[fast]}</b>`}。`, view({
          segMark: { [i]: "a" },
          clsAtSeg: { [i]: "a" },
          ptrs: { slow: off + slow, fast: fast !== null ? off + fast : null },
          hotEdges: [off + prevS],
          animEdges: [off + prevS],
        }), {
          at: "mid",
          facts: [["当前段", f(s)], ["段数", segs.length]],
        });
        if (fast === null) break;
      }
      const h = slow + 1, L = s.slice(0, h), R = s.slice(h);
      const prevCount = segs.length;
      segs.splice(i, 1, L, R);
      const offL = segStart(i), slowGlobal = offL + h - 1, midGlobal = offL + h;
      snap("mid, slow.next = slow.next, None", `slow 停在 <b>${s[slow]}</b>，记录 mid = ${s[h]} 并把 slow.next 置空，拆成 ${f(L)} 和 ${f(R)}。`, view({
        segMark: { [i]: "e", [i + 1]: "e" },
        clsAtSeg: { [i]: "e", [i + 1]: "e" },
        ptrs: { slow: slowGlobal, mid: midGlobal },
        ghostEdges: [[slowGlobal, midGlobal]],
        showNilAt: slowGlobal,
      }), {
        at: "cut",
        facts: [["拆分", `${f(L)} | ${f(R)}`, f(s)], ["段数", segs.length, prevCount]],
      });
      snap("递归排序左右两半", `先递归排序左半段 ${f(L)}，再排序右半段 ${f(R)}。`, view({
        segMark: { [i]: "a", [i + 1]: "d" },
        clsAtSeg: { [i]: "a" },
      }), {
        at: "rec",
        facts: [["当前目标", f(L)], ["段数", segs.length]],
      });
      sort(i);
      sort(i + 1);

      const x = segs[i], y = segs[i + 1];
      const offX = segStart(i), offY = segStart(i + 1);
      const m = [];
      let p = 0, q = 0;
      snap("准备合并", `${f(x)} 和 ${f(y)} 都已经有序，设 left、right 指向两段开头，依次挑较小的节点接起来。`, view({
        segMark: { [i]: "a", [i + 1]: "b" },
        clsAtSeg: { [i]: "a", [i + 1]: "b" },
        ptrs: { left: offX, right: offY },
        merging: [],
      }), {
        at: "merge",
        facts: [["待合并", `${f(x)} + ${f(y)}`], ["段数", segs.length]],
      });
      while (p < x.length && q < y.length) {
        const lv = x[p], rv = y[q];
        if (lv <= rv) {
          m.push(lv);
          p++;
          snap("合并：取 left 节点", `${lv} ≤ ${rv}，把 left 的 <b>${lv}</b> 接到新链表末尾，left 往前走一步。`, view({
            segMark: { [i]: "a", [i + 1]: "b" },
            clsAtSeg: { [i]: "a", [i + 1]: "b" },
            doneRange: [[offX, offX + p], [offY, offY + q]],
            ptrs: { left: p < x.length ? offX + p : null, right: offY + q },
            merging: m.slice(),
          }), {
            at: "merge",
            facts: [["比较", `${lv} ≤ ${rv}`], ["已合并", m.length, m.length - 1]],
          });
        } else {
          m.push(rv);
          q++;
          snap("合并：取 right 节点", `${lv} > ${rv}，把 right 的 <b>${rv}</b> 接到新链表末尾，right 往前走一步。`, view({
            segMark: { [i]: "a", [i + 1]: "b" },
            clsAtSeg: { [i]: "a", [i + 1]: "b" },
            doneRange: [[offX, offX + p], [offY, offY + q]],
            ptrs: { left: offX + p, right: q < y.length ? offY + q : null },
            merging: m.slice(),
          }), {
            at: "merge",
            facts: [["比较", `${lv} > ${rv}`], ["已合并", m.length, m.length - 1]],
          });
        }
      }
      const rest = p < x.length ? x.slice(p) : y.slice(q);
      if (rest.length) {
        const prevLen = m.length;
        m.push(...rest);
        snap("cur.next = left or right", `另一半已经空了，把剩余的 <b>${f(rest)}</b> 直接接到合并链表末尾。`, view({
          segMark: { [i]: "a", [i + 1]: "b" },
          doneRange: [[offX, offX + x.length], [offY, offY + y.length]],
          ptrs: {},
          merging: m.slice(),
        }), {
          at: "merge",
          facts: [["接上剩余", f(rest)], ["已合并", m.length, prevLen]],
        });
      }
      const prevSegs = segs.length;
      segs.splice(i, 2, m);
      const offM = segStart(i);
      const hot = m.slice(0, -1).map((_, k) => offM + k);
      snap("一段合并完成", `两半合并成有序链表 <b>${f(m)}</b>。`, view({
        segMark: { [i]: "k" },
        clsAtSeg: { [i]: "k" },
        hotEdges: hot,
        animEdges: hot,
      }), {
        at: "merge",
        facts: [["合并结果", f(m)], ["段数", segs.length, prevSegs]],
      });
    };

    sort(0);
    snap("完成", `所有段都合并回一条有序链表：<b>${f(segs[0])}</b>。`, view({ segMark: { 0: "k" }, clsAtSeg: { 0: "k" } }), {
      at: "done",
      kind: "ok",
      ans: segs[0].slice(),
      facts: [["段数", 1], ["结果", f(segs[0])]],
    });
  },
  points: [
    { t: "fast 从 head.next 出发", body: "这样两个节点的链表能断成 1 + 1。如果 fast 从 head 出发，会断成 2 + 0，递归永远不结束。" },
    { t: "一定要断开", body: "<code>slow.next = None</code> 不能少，否则左半段还连着右半段。" },
    { t: "复杂度", body: "时间 O(n log n)。递归栈深度 O(log n)。自底向上的写法可以做到 O(1) 空间。" },
  ],
};
