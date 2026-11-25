module.exports = {
  id: 287, name: "寻找重复数", title: "寻找重复数图解", level: "中等", topic: "技巧",
  h1: "寻找重复数，把数组当成链表找环",
  lede: "数组有 n + 1 个数，值都在 1 到 n 之间。把下标 i 看成一个节点，nums[i] 看成它指向的下一个节点。有两个下标指向同一个值，这个值就是环的入口。剩下的就和环形链表 II 一模一样：快慢指针相遇后，一个从头走，再次相遇的地方就是入口。",
  hints: [
    { t: "换一个角度看数组", body: ["从下标 0 出发，不断走 <code>i → nums[i]</code>。因为值都在 1..n，永远不会走出数组，也永远不会回到 0。", "n + 1 个下标、只有 n 种值，一定会走进一个环。"] },
    { t: "重复的数就是环的入口", body: ["重复的数 d 被两个不同的下标指向，所以 d 这个节点有两条入边，一条来自环外、一条来自环内，它就是环的入口。"] },
    { t: "Floyd 判圈", body: ["慢指针每次走一步，快指针每次走两步，直到相遇。", "然后让一个指针回到起点 0，两个指针每次都走一步，再次相遇的位置就是入口。证明同第 142 题。"] },
  ],
  codes: [{ t: "标准解法：快慢指针找环入口", code: `
class Solution:
    def findDuplicate(self, nums: List[int]) -> int:
        slow = fast = 0                     #@init
        while True:                         # 把 i -> nums[i] 看成链表 #@run
            slow = nums[slow]               #@run
            fast = nums[nums[fast]]         #@run
            if slow == fast:                #@run,meet
                break                       #@meet
        slow = 0                            # 一个回到起点，再同速走 #@reset
        while slow != fast:                 #@walk
            slow = nums[slow]               #@walk
            fast = nums[fast]               #@walk
        return slow                         # 相遇点就是环的入口 #@done
` }, { t: "简洁写法：对值二分", key: "bin", kind: "elegant", note: "设重复数是 d。≤ x 的数的个数，在 x &lt; d 时不超过 x，在 x ≥ d 时超过 x。二分找第一个超过的 x。时间 O(n log n)。", code: `
from bisect import bisect_left

class Solution:
    def findDuplicate(self, nums: List[int]) -> int:
        return bisect_left(range(len(nums)), True, key=lambda x: sum(v <= x for v in nums) > x)  #@init,left,right,done
` }],
  sig: { fn: "findDuplicate", params: ["int[]"], ret: "int" },
  call: (a) => [a.nums],
  cases: [[[1, 1]], [[3, 3, 3, 3, 3]], [[2, 5, 9, 6, 9, 3, 8, 9, 7, 1]], [[1, 4, 4, 2, 4]]],
  pytest: `
s = Solution()
assert s.findDuplicate([1,3,4,2,2]) == 2
assert s.findDuplicate([3,1,3,4,2]) == 3
assert s.findDuplicate([3,3,3,3,3]) == 3
assert s.findDuplicate([1,1]) == 1
assert s.findDuplicate([2,5,9,6,9,3,8,9,7,1]) == 9
`,
  method: "快慢指针",
  legend: [["a", "slow"], ["b", "fast"], ["c", "两者相遇"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 3, 4, 2, 2] }, note: "nums = [1,3,4,2,2]", expect: 2 },
    { label: "示例 2", args: { nums: [3, 1, 3, 4, 2] }, note: "nums = [3,1,3,4,2]", expect: 3 },
  ],
  build(a, snap) {
    const nums = a.nums.slice();
    let slow = 0, fast = 0;
    const path = (() => {
      const out = [0];
      let p = 0;
      for (let t = 0; t < nums.length + 2; t++) { p = nums[p]; out.push(p); }
      return out.map(String);
    })();
    const view = (meet, opts = {}) => [
      {
        t: "array",
        label: "nums（下标 i 指向下标 nums[i]）",
        items: nums.map((v, k) => ({ v, cls: meet && k === slow ? "c" : k === slow ? "a" : k === fast ? "b" : "" })),
        ptrs: { slow, fast },
        feeds: opts.feeds || [],
      },
      { t: "chips", label: "从 0 出发走过的路", items: path.slice() },
    ];
    snap(
      "开始",
      `把下标当节点：0 → ${nums[0]} → ${nums[nums[0]]} → …，一定会进入一个环。slow、fast 都从 0 出发。`,
      view(false),
      { at: "init", facts: [["slow", slow], ["fast", fast], ["阶段", "找相遇点"]] },
    );
    do {
      const oldS = slow, oldF = fast;
      slow = nums[slow];
      fast = nums[nums[fast]];
      const feeds = [];
      if (oldS !== slow) feeds.push({ from: oldS, to: slow, win: false, label: "slow×1" });
      if (oldF !== fast) feeds.push({ from: oldF, to: fast, win: true, label: "fast×2" });
      const met = slow === fast;
      snap(
        met ? "相遇" : "快慢指针",
        met
          ? `slow 和 fast 在下标 <b>${slow}</b> 相遇，说明有环。`
          : `slow 走一步：${oldS} → <b>${slow}</b>；fast 走两步：${oldF} → ${nums[oldF]} → <b>${fast}</b>。`,
        view(met, { feeds }),
        {
          at: met ? ["run", "meet"] : "run",
          kind: met ? "ok" : "",
          facts: [["slow", slow, oldS], ["fast", fast, oldF], ["阶段", met ? "首次相遇" : "找相遇点"]],
        },
      );
    } while (slow !== fast);
    const meetAt = slow;
    slow = 0;
    snap(
      "回到起点",
      "slow 回到起点 0，fast 留在相遇点。接下来两个指针每次都只走一步。",
      view(false),
      { at: "reset", facts: [["slow", slow, meetAt], ["fast", fast], ["阶段", "同速找入口"]] },
    );
    while (slow !== fast) {
      const oldS = slow, oldF = fast;
      slow = nums[slow];
      fast = nums[fast];
      const feeds = [];
      if (oldS !== slow) feeds.push({ from: oldS, to: slow, win: false, label: "slow" });
      if (oldF !== fast) feeds.push({ from: oldF, to: fast, win: true, label: "fast" });
      const met = slow === fast;
      snap(
        met ? "入口" : "同速走",
        met
          ? `两个指针在 <b>${slow}</b> 再次相遇，这就是环的入口，也就是重复的数。`
          : `slow 走一步到 <b>${slow}</b>，fast 走一步到 <b>${fast}</b>。`,
        view(met, { feeds }),
        { at: "walk", facts: [["slow", slow, oldS], ["fast", fast, oldF], ["阶段", met ? "找到入口" : "同速找入口"]] },
      );
    }
    snap("完成", `重复的数是 <b>${slow}</b>。`, view(true), {
      at: "done",
      kind: "ok",
      ans: slow,
      facts: [["slow", slow], ["fast", fast], ["重复数", slow]],
    });
  },
  alts: [{
    t: "对值二分",
    code: "bin",
    note: "和简洁写法一样：设重复的数是 d。数一数 nums 里 ≤ x 的有几个：x &lt; d 时不会超过 x，x ≥ d 时一定超过 x。二分找第一个超过的 x。",
    legend: [["a", "mid"], ["e", "nums 里 ≤ mid 的数"], ["d", "已经排除的值"], ["c", "答案"]],
    build(a, snap) {
      const nums = a.nums.slice(), n = nums.length;
      let lo = 0, hi = n, prevMid;
      const view = (mid, ans) => [
        { t: "array", label: "nums", items: nums.map((v) => ({ v, cls: mid >= 0 && v <= mid ? "e" : "" })) },
        {
          t: "array",
          label: "候选的值 x（0 到 n − 1）",
          items: Array.from({ length: n }, (_, x) => ({
            v: x,
            cls: x === ans ? "c" : x === mid ? "a" : x < lo || x >= hi ? "d" : "",
          })),
          idx: false,
          ptrs: { lo, hi: hi < n ? hi : null, mid: mid >= 0 ? mid : null },
        },
      ];
      const f = (mid, c, prevRange) => ({
        facts: [
          ["区间 [lo, hi)", `[${lo}, ${hi})`, prevRange],
          ["mid", mid === undefined ? "—" : mid, prevMid],
          ["≤ mid 的个数", c === undefined ? "—" : c],
        ],
      });
      snap("开始", `值都在 1 到 ${n - 1} 之间。1 到 x 只有 x 个不同的值，如果 nums 里 ≤ x 的数超过 x 个，1 到 x 里一定有重复。在 [${lo}, ${hi}) 里二分。`, view(-1, -1), { at: "init", ...f() });
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const c = nums.filter((v) => v <= mid).length;
        const at = c > mid ? "left" : "right";
        snap(
          "计算 mid 并统计",
          `mid = (${lo} + ${hi}) >> 1 = <b>${mid}</b>。数一数 nums 里 ≤ ${mid} 的数，共有 <b>${c}</b> 个。`,
          view(mid, -1),
          { at, ...f(mid, c) },
        );
        prevMid = mid;
        const prevRange = `[${lo}, ${hi})`;
        if (c > mid) {
          hi = mid;
          snap(
            "排除右半，收缩区间",
            `≤ ${mid} 的数有 ${c} 个 &gt; ${mid}，说明 [1, ${mid}] 里一定有重复，重复数 ≤ ${mid}。收缩右边界：hi = <b>${hi}</b>。`,
            view(mid, -1),
            { at: "left", ...f(mid, c, prevRange) },
          );
        } else {
          lo = mid + 1;
          snap(
            "排除左半，收缩区间",
            `≤ ${mid} 的数只有 ${c} 个 ≤ ${mid}，说明重复数一定比 ${mid} 大。排除 ≤ ${mid} 的值，收缩左边界：lo = <b>${lo}</b>。`,
            view(mid, -1),
            { at: "right", ...f(mid, c, prevRange) },
          );
        }
      }
      snap("完成", `lo = hi = ${lo}，它是第一个「≤ x 的数超过 x 个」的值，重复的数是 <b>${lo}</b>。时间 O(n log n)。`, view(-1, lo), {
        at: "done",
        kind: "ok",
        ans: lo,
        facts: [["区间 [lo, hi)", `[${lo}, ${hi})`], ["重复数", lo]],
      });
    },
  }],
  points: [
    { t: "从下标 0 出发", body: "值都在 1..n，没有任何下标指向 0，所以 0 一定在环外，是链表的「头」。" },
    { t: "不修改数组", body: "题目要求不修改、O(1) 空间，所以不能排序，也不能用原地标记的方法。" },
    { t: "复杂度", body: "快慢指针时间 O(n)，空间 O(1)。" },
  ],
};
