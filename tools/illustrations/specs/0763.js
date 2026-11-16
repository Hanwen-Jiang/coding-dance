module.exports = {
  id: 763, name: "划分字母区间", title: "划分字母区间图解", level: "中等", topic: "贪心算法",
  h1: "划分字母区间，片段的边界由最后一次出现决定",
  lede: "一个片段只要包含了某个字母，就必须把这个字母的所有出现都包进来，也就是至少要延伸到它最后一次出现的位置。从左往右走，不断把边界推到当前字母的最后位置，走到边界时就能切一刀。",
  hints: [
    { t: "先记下每个字母最后出现在哪", body: ["遍历一遍，<code>last[c]</code> 记字母 <code>c</code> 最后一次出现的下标。"] },
    { t: "片段的右边界会被撑大", body: ["从片段起点开始走，每遇到一个字母 <code>c</code>，片段至少要到 <code>last[c]</code>。", "<code>end = max(end, last[c])</code>。"] },
    { t: "什么时候切", body: ["走到 <code>i == end</code>，说明这一段里所有字母的最后一次出现都在 end 之前，可以切一刀。", "记录长度 <code>end - start + 1</code>，下一段从 <code>i + 1</code> 开始。"] },
  ],
  codes: [{ t: "标准解法：贪心", code: `
class Solution:
    def partitionLabels(self, s: str) -> List[int]:
        last = {c: i for i, c in enumerate(s)}  # 每个字母最后出现的位置 #@init
        res, start, end = [], 0, 0          #@init
        for i, c in enumerate(s):           #@grow
            end = max(end, last[c])             # 这一段至少要到 end #@grow
            if i == end:                        # 走到边界，切一刀 #@cut
                res.append(end - start + 1)     #@cut
                start = i + 1                   #@cut
        return res                          #@done
` }, { t: "简洁写法：记下切点再相减", kind: "elegant", note: "切点从 -1 开始，相邻切点的差就是每段长度。", code: `
class Solution:
    def partitionLabels(self, s: str) -> List[int]:
        last = {c: i for i, c in enumerate(s)}
        cuts, end = [-1], 0
        for i, c in enumerate(s):
            end = max(end, last[c])
            if i == end:
                cuts.append(i)
        return [b - a for a, b in zip(cuts, cuts[1:])]
` }],
  sig: { fn: "partitionLabels", params: ["string"], ret: "List<int>" },
  call: (a) => [a.s],
  cases: [["a"], ["abc"], ["eccbbbbdec"], ["aaaa"]],
  pytest: `
s = Solution()
assert s.partitionLabels("ababcbacadefegdehijhklij") == [9,7,8]
assert s.partitionLabels("eccbbbbdec") == [10]
assert s.partitionLabels("a") == [1]
assert s.partitionLabels("abc") == [1,1,1]
`,
  legend: [["e", "当前片段"], ["a", "当前字母"], ["b", "它最后出现的位置"], ["k", "已经切好的片段"]],
  presets: [
    { label: "示例 1", args: { s: "ababcbacadefegdehijhklij" }, note: "s = \"ababcbacadefegdehijhklij\"", expect: [9, 7, 8] },
    { label: "短一点", args: { s: "abacdcde" }, note: "s = \"abacdcde\"", expect: [3, 4, 1] },
  ],
  build(a, snap) {
    const s = a.s, last = {}, res = [], segs = [];
    for (let i = 0; i < s.length; i++) last[s[i]] = i;
    let start = 0, end = 0;
    const segOf = (k) => segs.findIndex(([x, y]) => k >= x && k <= y);
    const view = (i) => [
      { t: "array", label: "s", items: s.split("").map((c, k) => { const g = segOf(k); return { v: c, cls: g >= 0 ? (g % 2 ? "g" : "k") : k === i ? "a" : i >= 0 && k === last[s[i]] ? "b" : k >= start && k <= end && i >= 0 ? "e" : "" }; }), ptrs: { i: i >= 0 ? i : null, end: i >= 0 ? end : null } },
      { t: "chips", label: "片段长度", items: res.slice(), empty: "还没有" },
    ];
    snap("开始", `先记下每个字母最后出现的位置，比如 '${s[0]}' 最后在 ${last[s[0]]}。然后从左往右走。`, view(-1), { at: "init" });
    for (let i = 0; i < s.length; i++) {
      const old = end; end = Math.max(end, last[s[i]]);
      if (i === end) {
        snap("切一刀", `'${s[i]}' 最后出现在 ${last[s[i]]}。走到了 end = ${end}，这一段 [${start}, ${end}] 里的字母都不会再出现了，切下来，长度 <b>${end - start + 1}</b>。`, view(i), { at: ["grow", "cut"], kind: "ok", facts: [["start", start], ["end", end]] });
        res.push(end - start + 1); segs.push([start, end]); start = i + 1;
      } else snap(end > old ? "撑大边界" : "继续", `'${s[i]}' 最后出现在 ${last[s[i]]}。` + (end > old ? `片段至少要到 ${end}，end 从 ${old} 变成 <b>${end}</b>。` : `没有超过 end = ${end}。`), view(i), { at: "grow", facts: [["start", start], ["end", end]] });
    }
    snap("完成", `一共切成 ${res.length} 段，长度是 [${res.join(",")}]。`, view(-1), { at: "done", kind: "ok", ans: res.slice() });
  },
  points: [
    { t: "end 只增不减", body: "用 max 更新。片段里出现过的字母，边界只会越撑越大。" },
    { t: "切出来的段数最多", body: "每次都在最早能切的地方切，所以段数最多，正是题目要求的。" },
    { t: "复杂度", body: "两遍扫描，时间 O(n)。last 最多 26 个键，空间 O(1)。" },
  ],
};
