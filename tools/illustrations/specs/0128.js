module.exports = {
  id: 128, name: "最长连续序列", title: "最长连续序列图解", level: "中等", topic: "哈希",
  h1: "最长连续序列，只从起点开始数",
  lede: "题目要求 O(n)，所以不能排序。把所有数放进集合后，只从每段连续序列的起点开始往上数，每个数就只会被数到一次。",
  hints: [
    { t: "先让查找变快", body: ["把所有数放进集合（<code>set</code>），之后问「x 在不在」就是 <code>O(1)</code>。", "集合还顺手去了重。"] },
    { t: "从哪个数开始数", body: ["对每个数都往上数 <code>x+1, x+2, …</code> 会重复：从 1 数了 1,2,3,4，从 2 又数一遍 2,3,4。", "只从<strong>起点</strong>开始数。<code>x</code> 是起点的条件是 <code>x - 1</code> 不在集合里。"] },
    { t: "为什么是 O(n)", body: ["看起来有两层循环，但内层的 <code>while</code> 只在起点上跑，每个数最多被某一个起点数到一次，总共 <code>O(n)</code>。"] },
  ],
  codes: [{ t: "标准解法：集合 + 只从起点数", code: `
class Solution:
    def longestConsecutive(self, nums: List[int]) -> int:
        s = set(nums)
        best = 0
        for x in s:                     # 遍历集合，不是遍历 nums
            if x - 1 in s:
                continue                # 不是起点，跳过
            y = x
            while y + 1 in s:
                y += 1
            best = max(best, y - x + 1)
        return best
` }, { t: "简洁写法：只更新段的两个端点", kind: "elegant", note: "lens[x] 记 x 所在连续段的长度，但只保证段的两个端点是准的。新来的 x 把左右两段连起来，更新新段的两个端点即可。", code: `
class Solution:
    def longestConsecutive(self, nums: List[int]) -> int:
        lens, best = {}, 0
        for x in nums:
            if x not in lens:
                l, r = lens.get(x - 1, 0), lens.get(x + 1, 0)
                lens[x] = lens[x - l] = lens[x + r] = l + r + 1
                best = max(best, l + r + 1)
        return best
` }],
  pytest: `
s = Solution()
assert s.longestConsecutive([100,4,200,1,3,2]) == 4
assert s.longestConsecutive([0,3,7,2,5,8,4,6,0,1]) == 9
assert s.longestConsecutive([]) == 0
assert s.longestConsecutive([1,0,1,2]) == 3
`,
  legend: [["a", "正在检查"], ["w", "不是起点，跳过"], ["e", "这一段数到的"], ["c", "最长的一段"]],
  presets: [
    { label: "示例 1", args: { nums: [100, 4, 200, 1, 3, 2] }, note: "nums = [100,4,200,1,3,2]", expect: 4 },
    { label: "有重复", args: { nums: [9, 1, 4, 7, 3, 2, 8, 1, 6] }, note: "nums = [9,1,4,7,3,2,8,1,6]", expect: 4 },
  ],
  build(a, snap) {
    const set = [...new Set(a.nums)], has = new Set(set);
    let best = 0, bestRun = [];
    const view = (cur, run, skip) => [{ t: "chips", label: "集合（已去重）", items: set.map((v) => ({ v, cls: v === cur ? (skip ? "w" : "a") : run && run.includes(v) ? "e" : !run && bestRun.includes(v) ? "c" : "" })) }];
    snap("建集合", `把 nums 里的数放进集合，重复的只留一个，共 ${set.length} 个。`, view(null), { facts: [["最长", 0]] });
    for (const x of set) {
      if (has.has(x - 1)) {
        snap("跳过", `${x}：${x - 1} 在集合里，说明 ${x} 不是一段的起点。它会被前面的起点数到，<b>跳过</b>。`, view(x, null, true), { kind: "warn", facts: [["最长", best]] });
        continue;
      }
      const run = [x];
      snap("起点", `${x}：${x - 1} 不在集合里，${x} 是起点，从这里往上数。`, view(x, run), { facts: [["最长", best], ["当前长度", 1]] });
      let y = x;
      while (has.has(y + 1)) {
        y++; run.push(y);
        snap("往上数", `${y} 在集合里，接上。当前这段是 ${x} 到 ${y}，长度 ${run.length}。`, view(x, run), { facts: [["最长", best], ["当前长度", run.length]] });
      }
      const improved = run.length > best;
      if (improved) { best = run.length; bestRun = run.slice(); }
      snap("这段结束", `${y + 1} 不在集合里，这段到此为止，长度 ${run.length}。` + (improved ? `更新最长为 <b>${best}</b>。` : `没有超过当前最长 ${best}。`), view(null, run), { facts: [["最长", best], ["当前长度", run.length]] });
    }
    snap("完成", `所有数都看过了，最长连续序列的长度是 <b>${best}</b>（${bestRun[0]} 到 ${bestRun[bestRun.length - 1]}）。`, view(null), { kind: "ok", ans: best, facts: [["最长", best]] });
  },
  points: [
    { t: "遍历集合，不要遍历 nums", body: "nums 里有大量重复的起点时，遍历 nums 会让同一段被反复数，力扣有专门卡这一点的用例。" },
    { t: "起点判断是关键", body: "少了 <code>if x - 1 in s</code> 这一行，结果仍然对，但会退化成 O(n²)。" },
    { t: "空数组", body: "<code>best</code> 初始为 0，空数组不进循环，直接返回 0。" },
  ],
};
