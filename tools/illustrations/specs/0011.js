const F = require("../fig");

module.exports = {
  id: 11, name: "盛最多水的容器", title: "盛最多水的容器图解", level: "中等", topic: "双指针",
  h1: "盛最多水的容器，每次扔掉短的那块板",
  lede: "容器能装多少水，由两块板里短的那块和它们的距离决定。从最宽的容器开始，每次把短板往里收一格，就不会错过最优解。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "question_11.jpg": [F.bars([1, 8, 6, 2, 5, 4, 8, 3, 7], { label: "选下标 1 和 8 的两根线：宽 7，高 min(8, 7) = 7，能装 49（蓝色）", cls: (v, i) => (i === 1 || i === 8 ? "a" : ""), water: [0, 0, 1, 5, 2, 3, 0, 4, 0] })],
  },
  hints: [
    { t: "面积怎么算", body: ["选下标 <code>l</code> 和 <code>r</code> 两块板，面积是 <code>min(h[l], h[r]) × (r − l)</code>。", "高度看短板，宽度看距离。"] },
    { t: "从两端开始", body: ["先取最左和最右，这时宽度最大。", "之后每次只能往里收，宽度一定变小，所以只有高度变大才可能得到更大的面积。"] },
    { t: "为什么移动短板", body: ["移动长板：短板没变，高度不可能超过它，宽度还变小了，面积一定更小。", "移动短板：才有可能换到一块更高的板。所以每次移动短的那一边，被扔掉的短板不可能再组成更大的容器。"] },
  ],
  codes: [{ t: "标准解法：对撞双指针", kind: "elegant", code: `
class Solution:
    def maxArea(self, height: List[int]) -> int:
        l, r = 0, len(height) - 1       #@init
        best = 0                        #@init
        while l < r:
            best = max(best, min(height[l], height[r]) * (r - l))   #@area
            if height[l] < height[r]:   # 移动短板 #@move
                l += 1                  #@move
            else:                       #@move
                r -= 1                  #@move
        return best                     #@done
` }],
  pytest: `
s = Solution()
assert s.maxArea([1,8,6,2,5,4,8,3,7]) == 49
assert s.maxArea([1,1]) == 1
assert s.maxArea([4,3,2,1,4]) == 16
`,
  sig: { fn: "maxArea", params: ["int[]"], ret: "int" },
  call: (a) => [a.h],
  cases: [[[1, 1]], [[1, 2]], [[0, 0, 0]]],
  legend: [["a", "当前两块板（较长或相等）"], ["b", "较矮的短板"], ["c", "目前最大的一对"], ["d", "已经排除"]],
  presets: [
    { label: "示例 1", args: { h: [1, 8, 6, 2, 5, 4, 8, 3, 7] }, note: "height = [1,8,6,2,5,4,8,3,7]", expect: 49 },
    { label: "两边高", args: { h: [4, 3, 2, 1, 4] }, note: "height = [4,3,2,1,4]", expect: 16 },
  ],
  build(a, snap) {
    const h = a.h; let l = 0, r = h.length - 1, best = 0, bp = [-1, -1], prevArea = "—";
    const view = (done, shortIdx = -1) => [{
      t: "bars",
      label: "height",
      items: h.map((v, i) => ({
        v,
        cls: !done && i === shortIdx ? "b" : !done && (i === l || i === r) ? "a" : i === bp[0] || i === bp[1] ? "c" : i < l || i > r ? "d" : "",
      })),
      ptrs: done ? {} : { l, r },
    }];
    snap("开始", "l 在最左，r 在最右，从最宽的容器开始。", view(false), { at: "init", facts: [["最大面积", 0], ["当前面积", "—"], ["宽度 r − l", r - l]] });
    while (l < r) {
      const w = r - l, minH = Math.min(h[l], h[r]), area = minH * w, oldBest = best, up = area > best;
      if (up || bp[0] === -1) { best = Math.max(best, area); bp = [l, r]; }
      const moveL = h[l] < h[r], shortIdx = moveL ? l : r;
      snap(
        "计算面积",
        `短板是 ${moveL ? `左边 h[${l}] = ${h[l]}` : `右边 h[${r}] = ${h[r]}`}，面积 = min(${h[l]}, ${h[r]}) × (${r} − ${l}) = <b>${area}</b>。` + (up ? `超过 ${oldBest}，更新最大面积！` : `没有超过最大面积 ${best}。`),
        view(false, shortIdx),
        { at: "area", facts: [["最大面积", best, oldBest], ["当前面积", area, prevArea], ["宽 × 高", `${w} × ${minH}`]] },
      );
      const oldL = l, oldR = r;
      if (moveL) l++; else r--;
      snap(
        "移动短板",
        moveL
          ? `左边 ${h[oldL]} &lt; 右边 ${h[oldR]}：移动长板只会让宽度变小、高度仍受限于 ${h[oldL]}，面积必减；只有把短板 <b>l 右移</b>（${oldL} → ${l}）才可能更大。`
          : `右边 ${h[oldR]} ${h[oldL] === h[oldR] ? "等于" : "≤"} 左边 ${h[oldL]}：移动左边只会让宽度变小、高度不超过 ${h[oldR]}，面积必减；所以把 <b>r 左移</b>（${oldR} → ${r}）。`,
        view(false),
        { at: "move", facts: [["最大面积", best], ["当前面积", area], ["宽度 r − l", r - l, w]] },
      );
      prevArea = area;
    }
    snap("完成", `两个指针相遇，结束。最大面积是 <b>${best}</b>，由下标 ${bp[0]} 和 ${bp[1]} 的两块板围成。`, view(true), { at: "done", kind: "ok", ans: best, facts: [["最大面积", best]] });
  },
  points: [
    { t: "先算面积再移动", body: "每一对 (l, r) 都要先算面积、更新答案，然后才移动指针。" },
    { t: "一样高时移哪边都行", body: "两块板一样高时，任意移动一边都不会错过更优解，因为另一块之后也会被移走。" },
    { t: "复杂度", body: "两个指针一共走 n 步，时间 O(n)，空间 O(1)。" },
  ],
};
