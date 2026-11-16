module.exports = {
  id: 56, name: "合并区间", title: "合并区间图解", level: "中等", topic: "普通数组",
  h1: "合并区间，按起点排好队再一个个看",
  lede: "按起点排序之后，能合并的区间一定挨在一起。从左往右扫一遍：新区间的起点落在上一个区间里面就合并，否则另起一段。",
  hints: [
    { t: "先排序", body: ["按区间的<strong>起点</strong>从小到大排序。", "排序后，一个区间只可能和它前面那一段重叠，不用和所有区间比。"] },
    { t: "怎么判断重叠", body: ["设结果里最后一段是 <code>[s, e]</code>，新区间是 <code>[a, b]</code>。因为已经排序，<code>a ≥ s</code>。", "所以只要 <code>a ≤ e</code>，两段就重叠。"] },
    { t: "怎么合并", body: ["重叠时，把最后一段的终点改成 <code>max(e, b)</code>。", "要取 max，因为新区间可能完全被包在里面，比如 <code>[1,10]</code> 和 <code>[2,3]</code>。"] },
  ],
  codes: [{ t: "标准解法：排序 + 一次扫描", code: `
class Solution:
    def merge(self, intervals: List[List[int]]) -> List[List[int]]:
        intervals.sort()                # 默认先按起点排 #@sort
        res = []                        #@sort
        for a, b in intervals:
            if res and a <= res[-1][1]:             #@merge
                res[-1][1] = max(res[-1][1], b)   # 重叠，延长终点 #@merge
            else:
                res.append([a, b])                # 不重叠，另起一段 #@new
        return res                      #@done
` }, { t: "简洁写法：直接和结果的最后一段比", kind: "elegant", note: "结果列表的最后一段就是「当前正在合并的区间」，不用另外记 start、end。", code: `
class Solution:
    def merge(self, intervals: List[List[int]]) -> List[List[int]]:
        res = []
        for s, e in sorted(intervals):
            if res and s <= res[-1][1]:
                res[-1][1] = max(res[-1][1], e)
            else:
                res.append([s, e])
        return res
` }],
  pytest: `
s = Solution()
assert s.merge([[1,3],[2,6],[8,10],[15,18]]) == [[1,6],[8,10],[15,18]]
assert s.merge([[1,4],[4,5]]) == [[1,5]]
assert s.merge([[1,10],[2,3]]) == [[1,10]]
assert s.merge([[4,7],[1,4]]) == [[1,7]]
`,
  sig: { fn: "merge", params: ["int[][]"], ret: "int[][]" },
  call: (a) => [a.iv],
  cases: [[[[1, 4], [4, 5]]], [[[1, 10], [2, 3]]], [[[4, 7], [1, 4]]], [[[0, 0]]]],
  legend: [["a", "当前区间"], ["d", "已处理"], ["k", "刚被延长或新增的一段"]],
  presets: [
    { label: "示例 1", args: { iv: [[1, 3], [2, 6], [8, 10], [15, 18]] }, note: "intervals = [[1,3],[2,6],[8,10],[15,18]]", expect: [[1, 6], [8, 10], [15, 18]] },
    { label: "乱序 + 包含", args: { iv: [[8, 9], [1, 10], [2, 3], [10, 12], [14, 15]] }, note: "intervals = [[8,9],[1,10],[2,3],[10,12],[14,15]]", expect: [[1, 12], [14, 15]] },
  ],
  build(a, snap) {
    const iv = a.iv.map((x) => x.slice()).sort((x, y) => x[0] - y[0] || x[1] - y[1]), res = [];
    const f = (x) => `[${x[0]}, ${x[1]}]`;
    const view = (i, touched) => [
      { t: "chips", label: "按起点排序后的区间", items: iv.map((x, j) => ({ v: f(x), cls: j === i ? "a" : j < i ? "d" : "" })) },
      { t: "chips", label: "结果", items: res.map((x, j) => ({ v: f(x), cls: touched && j === res.length - 1 ? "k" : "" })), empty: "还没有" },
    ];
    snap("排序", "先按起点排序。之后能合并的区间一定是挨着的。", view(-1), { at: "sort" });
    iv.forEach(([s, e], i) => {
      const last = res[res.length - 1];
      if (last && s <= last[1]) {
        const old = f(last); last[1] = Math.max(last[1], e);
        snap("合并", `${f([s, e])} 的起点 ${s} 不超过上一段 ${old} 的终点，两段<b>重叠</b>。终点取较大的，上一段变成 ${f(last)}。`, view(i, true), { at: "merge" });
      } else {
        res.push([s, e]);
        snap("另起一段", last ? `${f([s, e])} 的起点 ${s} 大于上一段的终点 ${last[1]}，不重叠，作为新的一段。` : `结果是空的，${f([s, e])} 直接放进去。`, view(i, true), { at: "new" });
      }
    });
    snap("完成", `合并后剩下 <b>${res.length}</b> 段。`, view(iv.length), { at: "done", kind: "ok", ans: res });
  },
  points: [
    { t: "终点要取 max", body: "不能直接用新区间的终点覆盖。新区间可能被完全包含，终点反而更小。" },
    { t: "端点相接也算重叠", body: "<code>[1,4]</code> 和 <code>[4,5]</code> 要合并，所以判断用 <code>&lt;=</code>。" },
    { t: "复杂度", body: "排序 O(n log n)，扫描 O(n)。" },
  ],
};
