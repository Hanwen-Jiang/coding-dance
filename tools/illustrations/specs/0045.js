module.exports = {
  id: 45, name: "跳跃游戏 II", title: "跳跃游戏 II图解", level: "中等", topic: "贪心算法",
  h1: "跳跃游戏 II，一跳覆盖一个区间",
  lede: "把跳跃看成一层一层往外扩：跳 0 次能到 [0, 0]，跳 1 次能到的位置是一个区间，跳 2 次又是下一个区间。走完当前区间时，下一个区间的右端已经算好了，跳数加一，接着走。",
  hints: [
    { t: "按跳数分层", body: ["跳 k 次能到的所有位置，是一段连续的区间。", "走完这个区间的同时，记下从区间里任意位置能跳到的最远位置 <code>far</code>，它就是跳 k + 1 次能到的右端。"] },
    { t: "什么时候跳数加一", body: ["用 <code>end</code> 记当前这一跳的右端。走到 <code>i == end</code> 时，这一层走完了，必须再跳一次：<code>jumps += 1</code>，<code>end = far</code>。"] },
    { t: "最后一个位置不用遍历", body: ["循环只走到 <code>n - 2</code>。如果走到 <code>n - 1</code> 正好是某一层的右端，会多算一跳。"] },
  ],
  codes: [{ t: "标准解法：贪心，按层扩展", code: `
class Solution:
    def jump(self, nums: List[int]) -> int:
        jumps, end, far = 0, 0, 0           # end：当前这一跳能到的右端 #@init
        for i in range(len(nums) - 1):      # 最后一个位置不用再跳
            far = max(far, i + nums[i])     #@far,edge
            if i == end:                    # 这一层走完了，必须再跳一次 #@far,edge
                jumps += 1                  #@jump
                end = far                   #@jump
        return jumps                        #@done
` }, { t: "简洁写法：直接按区间跳", kind: "elegant", note: "[lo, hi] 是跳 jumps 次能到的区间，下一层是 [hi + 1, 区间里能跳到的最远处]。", code: `
class Solution:
    def jump(self, nums: List[int]) -> int:
        jumps, lo, hi = 0, 0, 0
        while hi < len(nums) - 1:
            lo, hi = hi + 1, max(i + nums[i] for i in range(lo, hi + 1))
            jumps += 1
        return jumps
` }],
  pytest: `
s = Solution()
assert s.jump([2,3,1,1,4]) == 2
assert s.jump([2,3,0,1,4]) == 2
assert s.jump([0]) == 0
assert s.jump([1,2,1,1,1]) == 3
assert s.jump([1,1,1,1]) == 3
`,
  sig: { fn: "jump", params: ["int[]"], ret: "int" },
  call: (a) => [a.nums],
  cases: [[[0]], [[2, 3, 0, 1, 4]], [[1, 1, 1, 1]], [[5, 1, 1]], [[1, 2]]],
  legend: [["k", "当前这一跳的区间"], ["a", "当前位置"], ["e", "下一跳能到的新位置"], ["c", "终点"]],
  presets: [
    { label: "示例 1", args: { nums: [2, 3, 1, 1, 4] }, note: "nums = [2,3,1,1,4]", expect: 2 },
    { label: "要跳 3 次", args: { nums: [1, 2, 1, 1, 1] }, note: "nums = [1,2,1,1,1]", expect: 3 },
  ],
  build(a, snap) {
    const nums = a.nums.slice(), n = nums.length;
    let jumps = 0, start = 0, end = 0, far = 0;
    const view = (i, fin, opts = {}) => [{
      t: "array",
      label: "nums",
      items: nums.map((v, k) => ({
        v,
        cls: fin && k === n - 1 ? "c" : k === i ? "a" : k >= start && k <= end ? "k" : k > end && k <= far ? "e" : "",
      })),
      ptrs: { i: i >= 0 ? i : null, end: Math.min(end, n - 1), far: far > end ? Math.min(far, n - 1) : null },
      feeds: opts.feeds || [],
    }];
    const f = (prevJumps, prevEnd, prevFar) => ({
      facts: [
        ["跳数", jumps, prevJumps],
        ["当前右端 end", end, prevEnd],
        ["最远可达 far", far, prevFar],
      ],
    });
    snap("开始", "跳 0 次能到的只有下标 0，这一层是 [0, 0]。", view(-1, false), { at: "init", ...f() });
    for (let i = 0; i < n - 1; i++) {
      const oldFar = far, reach = i + nums[i], improved = reach > oldFar;
      far = Math.max(far, reach);
      const to = Math.min(n - 1, reach);
      const feeds = to > i ? [{ from: i, to, win: improved, label: `+${nums[i]}` }] : [];
      if (i === end) {
        snap(
          "走到这一层末尾",
          `站在 ${i}，最远能到 ${reach}，far = ${far}。i 已经到了这一层的右端 end = ${end}，必须再跳一次。`,
          view(i, false, { feeds }),
          { at: "edge", ...f(undefined, undefined, oldFar) },
        );
        const oldJumps = jumps, oldEnd = end;
        jumps++; start = end + 1; end = far;
        snap(
          "跳一次",
          `跳数变成 <b>${jumps}</b>。跳 ${jumps} 次能到的新区间是 [${start}, ${Math.min(end, n - 1)}]。`,
          view(-1, false),
          { at: "jump", ...f(oldJumps, oldEnd) },
        );
      } else {
        snap(
          "扩展 far",
          `站在 ${i}，最远能到 ${i} + ${nums[i]} = ${reach}，` + (improved ? `far 从 ${oldFar} 更新为 <b>${far}</b>。` : `没有超过 far = ${far}。`) + "还在这一层里，先不跳。",
          view(i, false, { feeds }),
          { at: "far", ...f(undefined, undefined, oldFar) },
        );
      }
    }
    snap("完成", `终点 ${n - 1} 在第 ${jumps} 跳的区间里，最少跳 <b>${jumps}</b> 次。`, view(-1, true), { at: "done", kind: "ok", ans: jumps, ...f() });
  },
  points: [
    { t: "循环到 n - 2", body: "<code>range(len(nums) - 1)</code>。终点本身不需要再起跳。" },
    { t: "为什么贪心是对的", body: "每一层都把下一层的右端推到最远，跳数相同时能到的范围最大，不会比别的跳法差。" },
    { t: "复杂度", body: "一遍扫描，时间 O(n)，空间 O(1)。" },
  ],
};
