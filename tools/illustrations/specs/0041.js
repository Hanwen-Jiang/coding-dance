module.exports = {
  id: 41, name: "缺失的第一个正数", title: "缺失的第一个正数图解", level: "困难", topic: "普通数组",
  h1: "缺失的第一个正数，让每个数回到自己的座位",
  lede: "长度为 n 的数组，答案一定在 1 到 n+1 之间。把数组本身当成座位表：数 x 应该坐在下标 x−1 的位置。让每个能入座的数都坐好，然后从左往右找第一个坐错的位置。",
  hints: [
    { t: "答案的范围", body: ["数组有 n 个数。最好的情况是它们正好是 1 到 n，这时答案是 n+1。", "否则 1 到 n 里一定缺了某个数。所以答案只可能是 <code>1 … n+1</code>，负数、0、大于 n 的数都可以不管。"] },
    { t: "用数组本身当哈希表", body: ["题目要求 O(1) 额外空间，不能真的开哈希表。", "规定数 <code>x</code> 应该放在下标 <code>x − 1</code>。如果每个位置都满足 <code>nums[i] == i + 1</code>，就一个都不缺。"] },
    { t: "怎么让它们归位", body: ["对每个位置：如果上面的数 <code>x</code> 在 1 到 n 之间，而且它该去的位置上还不是 <code>x</code>，就把它换过去。", "换回来的数还没检查，所以要用 <code>while</code> 继续看当前位置。"] },
  ],
  codes: [{ t: "标准解法：原地归位", code: `
class Solution:
    def firstMissingPositive(self, nums: List[int]) -> int:
        n = len(nums)                   #@init
        for i in range(n):
            # nums[i] 应该放在下标 nums[i] - 1，那里还不是它，就换过去
            while 1 <= nums[i] <= n and nums[nums[i] - 1] != nums[i]:   #@swap,stay
                j = nums[i] - 1         #@swap
                nums[i], nums[j] = nums[j], nums[i]     #@swap
        for i in range(n):              #@scan
            if nums[i] != i + 1:        #@scan
                return i + 1            #@scan
        return n + 1                    #@done
` }, { t: "简洁写法：集合（不满足 O(1) 空间）", kind: "elegant", note: "答案一定在 1 到 n + 1 之间。放进集合挨个查，O(n) 时间、O(n) 空间。面试时先说这个，再讲原地归位。", code: `
class Solution:
    def firstMissingPositive(self, nums: List[int]) -> int:
        s = set(nums)
        return next(i for i in range(1, len(nums) + 2) if i not in s)
` }],
  sig: { fn: "firstMissingPositive", params: ["int[]"], ret: "int" },
  call: (a) => [a.nums],
  cases: [[[1]], [[2]], [[1, 1]], [[7, 8, 9]], [[-1, -2]], [[1, 2, 3]]],
  pytest: `
s = Solution()
assert s.firstMissingPositive([1,2,0]) == 3
assert s.firstMissingPositive([3,4,-1,1]) == 2
assert s.firstMissingPositive([7,8,9,11,12]) == 1
assert s.firstMissingPositive([1,1]) == 2
assert s.firstMissingPositive([1,2,3]) == 4
`,
  legend: [["a", "当前位置"], ["b", "要换过去的位置"], ["c", "坐对了：nums[i] = i + 1"], ["w", "第一个坐错的位置"]],
  presets: [
    { label: "示例 2", args: { nums: [3, 4, -1, 1] }, note: "nums = [3,4,-1,1]", expect: 2 },
    { label: "有重复", args: { nums: [2, 1, 2, 6, 4, 1] }, note: "nums = [2,1,2,6,4,1]", expect: 3 },
  ],
  build(a, snap) {
    const n = a.nums.slice(), len = n.length;
    const view = (opts = {}) => {
      const i = opts.i ?? -1, j = opts.j ?? -1, bad = opts.bad ?? -1;
      const prevMap = opts.prevMap || {};
      return [{
        t: "array",
        label: "nums（下标 i 上应该坐 i + 1）",
        items: n.map((v, t) => ({
          v,
          ...(prevMap[t] !== undefined ? { prev: prevMap[t] } : {}),
          cls: t === bad ? "w" : t === i ? "a" : t === j ? "b" : v === t + 1 ? "c" : "",
        })),
        ptrs: { i: i >= 0 ? i : null },
        swaps: opts.swaps || [],
      }];
    };
    snap("开始", `n = ${len}，答案只可能在 1 到 ${len + 1} 之间。规则：数 x 应该放在下标 x − 1。`, view(), { at: "init", facts: [["n", len]] });
    for (let i = 0; i < len; i++) {
      while (n[i] >= 1 && n[i] <= len && n[n[i] - 1] !== n[i]) {
        const j = n[i] - 1, x = n[i];
        snap("检查目标座位", `nums[${i}] = ${x} 应该坐在下标 ${j}，那里现在是 ${n[j]} ≠ ${x}，需要把它换过去。`, view({ i, j }), { at: "swap", facts: [["i", i], ["nums[i]", x], ["目标位置 j", j]] });
        const oldI = n[i], oldJ = n[j];
        [n[i], n[j]] = [n[j], n[i]];
        snap(
          "交换归位",
          `把 ${oldI} 换到下标 ${j}，原来的 ${oldJ} 换回下标 ${i}（换回来的数还没检查，i 留在原地继续看）。`,
          view({ i, j, swaps: [[i, j]], prevMap: { [i]: oldI, [j]: oldJ } }),
          { at: "swap", facts: [["i", i], ["nums[i]", n[i], oldI], ["归位", `${oldI} → [${j}]`]] },
        );
      }
      const x = n[i];
      snap("不用动", x === i + 1 ? `nums[${i}] = ${x}，已经坐对了。` : x < 1 || x > len ? `nums[${i}] = ${x} 不在 1 到 ${len} 之间，没有它的座位，留在这里。` : `nums[${i}] = ${x}，它的座位（下标 ${x - 1}）上已经有一个 ${x} 了，是重复的，留在这里。`, view({ i }), { at: "stay", kind: x === i + 1 ? "" : "warn", facts: [["i", i], ["nums[i]", x]] });
    }
    let ans = len + 1, bad = -1;
    for (let i = 0; i < len; i++) {
      if (n[i] !== i + 1) { ans = i + 1; bad = i; break; }
      snap("扫描检查", `下标 ${i} 上坐着 ${n[i]} == ${i + 1}，已归位，继续检查下一个。`, view({ i }), { at: "scan", facts: [["i", i], ["期望值", i + 1], ["实际值", n[i]]] });
    }
    snap("完成", bad >= 0 ? `从左往右找第一个坐错的位置：下标 ${bad} 上应该是 ${bad + 1}，实际是 ${n[bad]}。缺失的第一个正数是 <b>${ans}</b>。` : `每个位置都坐对了，1 到 ${len} 都在，答案是 <b>${ans}</b>。`, view({ bad }), { at: bad >= 0 ? "scan" : ["scan", "done"], kind: "ok", ans, facts: [["答案", ans]] });
  },
  points: [
    { t: "while 的第二个条件", body: "要比较 <code>nums[nums[i] - 1] != nums[i]</code>，而不是 <code>nums[i] != i + 1</code>。遇到重复的数时，后一种写法会死循环。" },
    { t: "交换的写法", body: "Python 里先把 <code>j = nums[i] - 1</code> 存下来再交换。直接写成一行的话，左边的下标会在赋值过程中变化。" },
    { t: "复杂度", body: "每次交换都让一个数归位，最多 n 次，时间 O(n)，空间 O(1)。" },
  ],
};
