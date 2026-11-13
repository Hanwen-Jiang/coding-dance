module.exports = {
  id: 234, name: "回文链表", title: "回文链表图解", level: "简单", topic: "链表",
  h1: "回文链表，把后半段反转过来再比",
  lede: "链表不能从后往前走。先用快慢指针找到中点，把后半段原地反转，然后一头一尾同时往中间走，逐个比较。这样只用常数的额外空间。",
  hints: [
    { t: "最直接的做法", body: ["把所有值复制到一个数组里，再用两个下标从两端往中间比。时间 <code>O(n)</code>，空间 <code>O(n)</code>。", "进阶要求空间 <code>O(1)</code>，就不能用数组。"] },
    { t: "找中点", body: ["<code>slow</code> 一次走一步，<code>fast</code> 一次走两步。<code>fast</code> 走到头时，<code>slow</code> 正好在中间。"] },
    { t: "反转后半段", body: ["从 <code>slow</code> 开始把后半段反转（就是 206 题）。", "然后一个指针从头出发，一个从原来的尾巴出发，逐个比较，直到后半段走完。"] },
  ],
  codes: [{ t: "标准解法：快慢指针 + 反转后半段", code: `
class Solution:
    def isPalindrome(self, head: Optional[ListNode]) -> bool:
        slow = fast = head
        while fast and fast.next:       # 找中点
            slow = slow.next
            fast = fast.next.next
        prev = None
        while slow:                     # 反转后半段
            slow.next, prev, slow = prev, slow, slow.next
        left, right = head, prev
        while right:                    # 两头往中间比
            if left.val != right.val:
                return False
            left, right = left.next, right.next
        return True
` }],
  pytest: `
s = Solution()
assert s.isPalindrome(L([1,2,2,1])) is True
assert s.isPalindrome(L([1,2])) is False
assert s.isPalindrome(L([1,2,3,2,1])) is True
assert s.isPalindrome(L([1])) is True
assert s.isPalindrome(L([1,2,3,3,1])) is False
`,
  legend: [["a", "slow / left"], ["b", "fast / right"], ["k", "比较过，相等"], ["w", "不相等"]],
  presets: [
    { label: "示例 1", args: { v: [1, 2, 2, 1] }, note: "head = [1,2,2,1]", expect: true },
    { label: "奇数个", args: { v: [1, 2, 3, 2, 1] }, note: "head = [1,2,3,2,1]", expect: true },
    { label: "不是回文", args: { v: [1, 2, 3, 3, 1] }, note: "head = [1,2,3,3,1]", expect: false },
  ],
  build(a, snap) {
    const v = a.v, n = v.length, next = v.map((_, i) => (i + 1 < n ? i + 1 : null)), st = v.map(() => "");
    let slow = 0, fast = 0;
    const view = (ptrs, ca, cb) => [{ t: "list", label: "链表", nodes: v.map((x, i) => ({ v: x, cls: i === ca ? "a" : i === cb ? "b" : st[i] })), next: next.slice(), ptrs }];
    snap("找中点", "slow 和 fast 都从头出发。slow 每次走一步，fast 每次走两步。", view({ slow, fast }, slow, fast));
    while (fast !== null && fast + 1 < n) {
      slow++; fast = fast + 2 < n ? fast + 2 : null;
      snap("找中点", fast === null ? `slow 走到 ${v[slow]}，fast 走出了链表。` : `slow 走到 ${v[slow]}，fast 走到 ${v[fast]}。`, view({ slow, fast }, slow, fast));
    }
    const mid = slow;
    for (let i = mid; i < n; i++) next[i] = i === mid ? null : i - 1;
    snap("反转后半段", `fast 到头了，slow 停在 ${v[mid]}，这里就是后半段的起点。把从它开始的后半段反转，箭头全部掉头。`, view({ slow: mid }, mid));
    let l = 0, r = n - 1, ok = true;
    while (r >= mid) {
      const same = v[l] === v[r];
      st[l] = st[r] = same ? "k" : "w";
      snap(same ? "比较" : "不相等", `left 是 ${v[l]}，right 是 ${v[r]}，` + (same ? "相等，两边各往中间走一步。" : "<b>不相等</b>，不是回文。"), view({ left: l, right: r }), same ? {} : { kind: "warn" });
      if (!same) { ok = false; break; }
      l++; r--;
    }
    snap("完成", ok ? "后半段走完了，每一对都相等。是回文链表，返回 true。" : "发现一对不相等的值，返回 false。", view({}), { kind: ok ? "ok" : "warn", ans: ok });
  },
  points: [
    { t: "奇数个节点", body: "中间那个节点会被算进后半段，和自己前面的节点比较完就结束，不影响结果。" },
    { t: "循环条件看 right", body: "后半段不比前半段长，所以以 <code>right</code> 走完为准。" },
    { t: "链表被改了", body: "这个做法修改了原链表。面试时可以提一句：需要的话，比较完再把后半段反转回去。" },
  ],
};
