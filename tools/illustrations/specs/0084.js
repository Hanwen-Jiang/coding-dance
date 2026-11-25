const F = require("../fig");

module.exports = {
  id: 84, name: "柱状图中最大的矩形", title: "柱状图中最大的矩形图解", level: "困难", topic: "栈",
  h1: "柱状图中最大的矩形，每根柱子往两边能撑多宽",
  lede: "以某根柱子的高度为矩形的高，矩形能往左右延伸到第一根比它矮的柱子为止。用一个高度递增的单调栈：一根柱子被弹出时，右边界就是让它弹出的那根，左边界就是它下面的栈元素。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "histogram.jpg": [F.bars([2, 1, 5, 6, 2, 3], { label: "最大的矩形在下标 2、3 上：高 5、宽 2，面积 10", cls: (v, i) => (i === 2 || i === 3 ? "e" : "") })],
    "histogram-1.jpg": [F.bars([2, 4], { label: "最大面积是 4（只用右边这根，或者两根都用、高取 2）" })],
  },
  hints: [
    { t: "固定高度", body: ["最大矩形的高一定等于某根柱子的高度。", "以第 <code>i</code> 根柱子为高，宽度是：左边第一根比它矮的柱子和右边第一根比它矮的柱子之间的距离。"] },
    { t: "单调递增栈", body: ["栈里存下标，对应的高度从底到顶递增。新柱子比栈顶矮时，栈顶的右边界就找到了，就是新柱子。", "栈顶弹出后，新的栈顶比它矮，就是它的左边界。面积 = <code>高 × (i - 新栈顶 - 1)</code>。"] },
    { t: "两头加哨兵", body: ["在高度数组两头各加一个 0。左边的 0 永远不会被弹出，省掉判空；右边的 0 会把栈里剩下的柱子全部弹出结算。"] },
  ],
  codes: [{ t: "标准解法：单调栈 + 哨兵", code: `
class Solution:
    def largestRectangleArea(self, heights: List[int]) -> int:
        heights = [0] + heights + [0]       # 两头加哨兵 #@init
        stack, best = [], 0                 # 栈里下标对应的高度递增 #@init
        for i, h in enumerate(heights):
            while stack and heights[stack[-1]] > h:     #@pop
                top = stack.pop()           # 以它为高的矩形，右边界是 i #@pop
                left = stack[-1]            # 左边界是新的栈顶 #@pop
                best = max(best, heights[top] * (i - left - 1))     #@pop
            stack.append(i)                 #@push
        return best                         #@done
` }, { t: "简洁写法：只在右边补 0", kind: "elegant", note: "栈底放 -1，h[-1] 正好是补在末尾的 0，同时充当左边的哨兵，循环条件也不用判空。", code: `
class Solution:
    def largestRectangleArea(self, heights: List[int]) -> int:
        h, stack, best = heights + [0], [-1], 0
        for i, x in enumerate(h):
            while x < h[stack[-1]]:
                height = h[stack.pop()]
                best = max(best, height * (i - stack[-1] - 1))
            stack.append(i)
        return best
` }],
  sig: { fn: "largestRectangleArea", params: ["int[]"], ret: "int" },
  call: (a) => [a.h],
  cases: [[[1]], [[0]], [[2, 2, 2]], [[6, 2, 5, 4, 5, 1, 6]], [[1, 2, 3, 4, 5]]],
  pytest: `
s = Solution()
assert s.largestRectangleArea([2,1,5,6,2,3]) == 10
assert s.largestRectangleArea([2,4]) == 4
assert s.largestRectangleArea([1]) == 1
assert s.largestRectangleArea([2,2,2]) == 6
assert s.largestRectangleArea([6,2,5,4,5,1,6]) == 12
`,
  legend: [["e", "在栈里"], ["a", "当前柱子 / 新压栈"], ["b", "被弹出、正在结算的柱子"], ["w", "它撑出来的矩形"], ["c", "目前最大的矩形"], ["d", "哨兵 0"]],
  presets: [
    { label: "示例 1", args: { h: [2, 1, 5, 6, 2, 3] }, note: "heights = [2,1,5,6,2,3]", expect: 10 },
    { label: "示例 2", args: { h: [2, 4] }, note: "heights = [2,4]", expect: 4 },
  ],
  build(a, snap) {
    const H = [0, ...a.h, 0], stack = []; let best = 0, bestR = null, bestW = 0, bestH = 0;
    const view = (i, top, rect, opts = {}) => {
      const done = !!opts.done, better = !!opts.better;
      return [
        {
          t: "bars",
          label: "heights（两头是哨兵 0）",
          items: H.map((v, k) => ({
            v,
            cls: done
              ? (bestR && k > bestR[0] && k < bestR[1] ? "c" : (k === 0 || k === H.length - 1) ? "d" : "")
              : k === top ? "b"
              : k === i ? "a"
              : rect && k > rect[0] && k < rect[1] ? (better ? "c" : "w")
              : stack.includes(k) ? "e"
              : (k === 0 || k === H.length - 1) ? "d"
              : "",
          })),
          ptrs: { i: !done && i >= 0 ? i : null },
          feeds: opts.feeds || [],
        },
        {
          t: "chips",
          label: "栈（存下标，右边是栈顶）",
          items: stack.map((k, idx) => ({
            v: `${k}:${H[k]}`,
            cls: opts.pushed && idx === stack.length - 1 ? "a" : "e",
          })),
          empty: "空",
        },
      ];
    };
    let prevBest = 0, prevArea = "—", prevLen = 0;
    snap("开始", "两头各加一根高度为 0 的哨兵柱子。栈里存下标，对应高度递增。", view(-1, -1), {
      at: "init",
      facts: [["最大面积", 0], ["本次面积", "—"], ["栈长度", 0]],
    });
    for (let i = 0; i < H.length; i++) {
      while (stack.length && H[stack[stack.length - 1]] > H[i]) {
        const top = stack.pop(), left = stack[stack.length - 1], w = i - left - 1, area = H[top] * w;
        const better = area > best;
        if (better) { best = area; bestR = [left, i]; bestW = w; bestH = H[top]; }
        const curArea = `${H[top]}×${w}=${area}`;
        snap(
          "结算",
          `${H[i]} 比栈顶的 ${H[top]} 矮，以 ${H[top]} 为高的矩形右边到不了 ${i}，左边到不了新栈顶 ${left}。宽 ${w}，面积 <b>${area}</b>${better ? "，是目前最大的" : ""}。`,
          view(i, top, [left, i], {
            better,
            feeds: [{ from: top, to: i, win: better, label: `宽${w}×${H[top]}=${area}` }],
          }),
          {
            at: "pop",
            kind: better ? "ok" : "",
            facts: [
              best !== prevBest ? ["最大面积", best, prevBest] : ["最大面积", best],
              curArea !== prevArea ? ["本次面积", curArea, prevArea] : ["本次面积", curArea],
              stack.length !== prevLen ? ["栈长度", stack.length, prevLen] : ["栈长度", stack.length],
            ],
          },
        );
        prevBest = best; prevArea = curArea; prevLen = stack.length;
      }
      stack.push(i);
      if (i > 0 && i < H.length - 1) {
        snap("压栈", `${H[i]} 不比栈顶矮，压栈。`, view(i, -1, null, { pushed: true }), {
          at: "push",
          facts: [
            ["最大面积", best],
            ["当前高", H[i]],
            stack.length !== prevLen ? ["栈长度", stack.length, prevLen] : ["栈长度", stack.length],
          ],
        });
        prevArea = "—";
      }
      prevLen = stack.length;
    }
    snap("完成", `最大矩形面积是 <b>${best}</b>。`, view(-1, -1, null, { done: true }), {
      at: "done",
      kind: "ok",
      ans: best,
      facts: [["最大面积", best], ["最佳宽×高", bestR ? `${bestW}×${bestH}` : "0"]],
    });
  },
  points: [
    { t: "宽度是 i − left − 1", body: "左右边界都是比它矮的柱子，本身不算在矩形里。" },
    { t: "相等的高度", body: "用 <code>&gt;</code> 弹出，相等的不弹。这样相等高度里靠左的那根会算少，但最右边那根结算时宽度是对的，答案不受影响。" },
    { t: "复杂度", body: "每根柱子进出栈各一次，时间 O(n)，空间 O(n)。" },
  ],
};
