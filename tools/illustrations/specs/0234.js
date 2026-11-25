const F = require("../fig");

module.exports = {
  id: 234, name: "回文链表", title: "回文链表图解", level: "简单", topic: "链表",
  h1: "回文链表，把后半段反转过来再比",
  lede: "链表不能从后往前走。先用快慢指针找到中点，把后半段原地反转，然后一头一尾同时往中间走，逐个比较。这样只用常数的额外空间。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "pal1linked-list.jpg": [F.list([1, 2, 2, 1], { label: "正着读、倒着读都是 1 2 2 1", cls: (v, i) => (i === 0 || i === 3 ? "e" : "g") })],
    "pal2linked-list.jpg": [F.list([1, 2], { label: "倒着读是 2 1，不是回文" })],
  },
  hints: [
    { t: "最直接的做法", body: ["把所有值复制到一个数组里，再用两个下标从两端往中间比。时间 <code>O(n)</code>，空间 <code>O(n)</code>。", "进阶要求空间 <code>O(1)</code>，就不能用数组。"] },
    { t: "找中点", body: ["<code>slow</code> 一次走一步，<code>fast</code> 一次走两步。<code>fast</code> 走到头时，<code>slow</code> 正好在中间。"] },
    { t: "反转后半段", body: ["从 <code>slow</code> 开始把后半段反转（就是 206 题）。", "然后一个指针从头出发，一个从原来的尾巴出发，逐个比较，直到后半段走完。"] },
  ],
  codes: [{ t: "标准解法：快慢指针 + 反转后半段", code: `
class Solution:
    def isPalindrome(self, head: Optional[ListNode]) -> bool:
        slow = fast = head              #@init
        while fast and fast.next:       # 找中点 #@mid
            slow = slow.next            #@mid
            fast = fast.next.next       #@mid
        prev = None                     #@rev
        while slow:                     # 反转后半段 #@rev
            slow.next, prev, slow = prev, slow, slow.next   #@rev
        left, right = head, prev        #@cmp
        while right:                    # 两头往中间比 #@cmp
            if left.val != right.val:   #@cmp,bad
                return False            #@bad
            left, right = left.next, right.next     #@cmp
        return True                     #@done
` }, { t: "简洁写法：转成列表（O(n) 空间）", kind: "elegant", note: "把值取出来，和反过来的自己比。不满足进阶的 O(1) 空间。", code: `
class Solution:
    def isPalindrome(self, head: Optional[ListNode]) -> bool:
        vals = []
        while head:
            vals.append(head.val)
            head = head.next
        return vals == vals[::-1]
` }],
  pytest: `
s = Solution()
assert s.isPalindrome(L([1,2,2,1])) is True
assert s.isPalindrome(L([1,2])) is False
assert s.isPalindrome(L([1,2,3,2,1])) is True
assert s.isPalindrome(L([1])) is True
assert s.isPalindrome(L([1,2,3,3,1])) is False
`,
  sig: { fn: "isPalindrome", params: ["ListNode"], ret: "bool" },
  call: (a) => [a.v],
  cases: [[[1]], [[1, 2]], [[1, 1]], [[1, 0, 0]], [[9, 9, 9, 9, 9]]],
  legend: [["a", "slow / left"], ["b", "fast / right"], ["e", "已反转的后半段"], ["k", "比较过，相等"], ["w", "不相等"]],
  presets: [
    { label: "示例 1", args: { v: [1, 2, 2, 1] }, note: "head = [1,2,2,1]", expect: true },
    { label: "奇数个", args: { v: [1, 2, 3, 2, 1] }, note: "head = [1,2,3,2,1]", expect: true },
    { label: "不是回文", args: { v: [1, 2, 3, 3, 1] }, note: "head = [1,2,3,3,1]", expect: false },
  ],
  build(a, snap) {
    const v = a.v, n = v.length;
    if (!n) {
      snap("空链表", "链表为空，直接返回 true。", [{ t: "note", label: "链表", html: "空" }], { at: "done", kind: "ok", ans: true });
      return;
    }
    const next = v.map((_, i) => (i + 1 < n ? i + 1 : null)), st = v.map(() => "");
    let slow = 0, fast = 0;
    const view = (opts = {}) => [{
      t: "list",
      label: "链表（虚红线 × 表示断开的旧指针，高亮弧线表示新掉头的指针）",
      nodes: v.map((x, i) => ({
        v: x,
        cls: i === opts.ca ? "a" : i === opts.cb ? "b" : st[i],
        ...(opts.hot && opts.hot.includes(i) ? { ecls: "on" } : {}),
      })),
      next: next.slice(),
      ptrs: opts.ptrs || {},
      ...(opts.ghostEdges ? { ghostEdges: opts.ghostEdges.slice() } : {}),
      ...(opts.animEdges ? { animEdges: opts.animEdges.slice() } : {}),
    }];
    snap("slow = fast = head", "第一步：slow 和 fast 都从头节点出发。slow 每次走 1 步，fast 每次走 2 步，寻找中点。", view({ ptrs: { slow, fast }, ca: slow, cb: fast }), {
      at: "init",
      facts: [["阶段", "1. 找中点"], ["slow 下标", 0]],
    });
    while (fast !== null && fast + 1 < n) {
      const prevS = slow;
      slow++;
      fast = fast + 2 < n ? fast + 2 : null;
      snap("快慢指针推进", fast === null ? `slow 走到 <b>${v[slow]}</b>（下标 ${slow}），fast 走出了链表。` : `slow 走到 <b>${v[slow]}</b>（下标 ${slow}），fast 走到 <b>${v[fast]}</b>（下标 ${fast}）。`, view({
        ptrs: { slow, fast },
        ca: slow,
        cb: fast,
        hot: [prevS],
        animEdges: [prevS],
      }), {
        at: "mid",
        facts: [["阶段", "1. 找中点"], ["slow 下标", slow, prevS]],
      });
    }
    const mid = slow;
    let prev = null, cur = mid, revCount = 0;
    snap("prev = None（准备反转后半段）", `fast 到头了，slow 停在 <b>${v[mid]}</b>（后半段起点）。设 prev = None，逐个把后半段箭头掉头。`, view({ ptrs: { prev, slow: cur }, ca: cur }), {
      at: "rev",
      facts: [["阶段", "2. 反转后半段", "1. 找中点"], ["已反转", 0]],
    });
    while (cur !== null) {
      const nxt = cur + 1 < n ? cur + 1 : null;
      snap("先存 nxt = slow.next", `准备改 ${v[cur]}.next，先用 nxt 记住它的下一个节点${nxt === null ? "（空）" : ` <b>${v[nxt]}</b>`}。`, view({
        ptrs: { prev, slow: cur, nxt },
        ca: cur,
        cb: prev,
      }), {
        at: "rev",
        facts: [["阶段", "2. 反转后半段"], ["已反转", revCount]],
      });
      next[cur] = prev;
      st[cur] = "e";
      const prevRev = revCount;
      revCount += 1;
      snap("断旧连新：slow.next = prev", `把 ${v[cur]}.next 改成指向 prev（<b>${prev === null ? "空" : v[prev]}</b>）${nxt !== null ? `，断开原本指往 ${v[nxt]} 的箭头` : ""}。`, view({
        ptrs: { prev, slow: cur, nxt },
        ca: cur,
        cb: prev,
        hot: [cur],
        animEdges: [cur],
        ...(nxt !== null ? { ghostEdges: [[cur, nxt]] } : {}),
      }), {
        at: "rev",
        facts: [["阶段", "2. 反转后半段"], ["已反转", revCount, prevRev]],
      });
      prev = cur;
      cur = nxt;
      snap("推进 prev, slow", cur === null ? `prev 移到 ${v[prev]}，slow 走到空，后半段反转完成。` : `prev 移到 ${v[prev]}，slow 沿着 nxt 移到 <b>${v[cur]}</b>。`, view({
        ptrs: { prev, slow: cur },
        ca: cur,
        cb: prev,
      }), {
        at: "rev",
        facts: [["阶段", "2. 反转后半段"], ["已反转", revCount]],
      });
    }

    let l = 0, r = prev, ok = true, cmpCount = 0;
    snap("left, right = head, prev", `第三步：left 从头节点 <b>${v[l]}</b> 出发，right 从反转后的头 <b>${v[r]}</b> 出发，两头往中间比。`, view({ ptrs: { left: l, right: r }, ca: l, cb: r }), {
      at: "cmp",
      facts: [["阶段", "3. 两端比较", "2. 反转后半段"], ["已比较", 0]],
    });
    while (r !== null) {
      const same = v[l] === v[r];
      st[l] = st[r] = same ? "k" : "w";
      if (!same) {
        ok = false;
        snap("不相等", `left 是 <b>${v[l]}</b>，right 是 <b>${v[r]}</b>，<b>不相等</b>！不是回文链表。`, view({ ptrs: { left: l, right: r } }), {
          at: ["cmp", "bad"],
          kind: "warn",
          facts: [["阶段", "3. 两端比较"], ["已比较", cmpCount]],
        });
        break;
      }
      const prevCmp = cmpCount;
      cmpCount += 1;
      snap("比较相等", `left 是 ${v[l]}，right 是 ${v[r]}，相等！`, view({ ptrs: { left: l, right: r } }), {
        at: "cmp",
        facts: [["阶段", "3. 两端比较"], ["已比较", cmpCount, prevCmp]],
      });
      const oldL = l, oldR = r;
      l = next[l];
      r = next[r];
      const hot = [];
      if (l !== null && oldL !== oldR) hot.push(oldL);
      if (r !== null) hot.push(oldR);
      snap("left, right 各进一步", r === null ? "right 沿反转指针走到了空，所有节点都比完了。" : `left 移到 <b>${v[l]}</b>，right 沿着反转后的指针移到 <b>${v[r]}</b>。`, view({
        ptrs: { left: l, right: r },
        ca: l,
        cb: r,
        hot,
        animEdges: hot,
      }), {
        at: "cmp",
        facts: [["阶段", "3. 两端比较"], ["已比较", cmpCount]],
      });
    }
    snap("完成", ok ? "后半段走完了，每一对都相等。是回文链表，返回 <b>true</b>。" : "发现一对不相等的值，返回 <b>false</b>。", view({}), {
      at: ok ? "done" : "bad",
      kind: ok ? "ok" : "warn",
      ans: ok,
      facts: [["阶段", "完成", "3. 两端比较"], ["结果", ok ? "true" : "false"]],
    });
  },
  points: [
    { t: "奇数个节点", body: "中间那个节点会被算进后半段，和自己前面的节点比较完就结束，不影响结果。" },
    { t: "循环条件看 right", body: "后半段不比前半段长，所以以 <code>right</code> 走完为准。" },
    { t: "链表被改了", body: "这个做法修改了原链表。面试时可以提一句：需要的话，比较完再把后半段反转回去。" },
  ],
};
