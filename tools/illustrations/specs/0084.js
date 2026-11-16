module.exports = {
  id: 84, name: "柱状图中最大的矩形", title: "柱状图中最大的矩形图解", level: "困难", topic: "栈",
  h1: "柱状图中最大的矩形，每根柱子往两边能撑多宽",
  lede: "以某根柱子的高度为矩形的高，矩形能往左右延伸到第一根比它矮的柱子为止。用一个高度递增的单调栈：一根柱子被弹出时，右边界就是让它弹出的那根，左边界就是它下面的栈元素。",
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
  legend: [["e", "在栈里"], ["a", "当前柱子"], ["b", "被弹出、正在结算的柱子"], ["w", "它撑出来的矩形"], ["c", "目前最大的矩形"]],
  presets: [
    { label: "示例 1", args: { h: [2, 1, 5, 6, 2, 3] }, note: "heights = [2,1,5,6,2,3]", expect: 10 },
    { label: "示例 2", args: { h: [2, 4] }, note: "heights = [2,4]", expect: 4 },
  ],
  build(a, snap) {
    const H = [0, ...a.h, 0], stack = []; let best = 0, bestR = null;
    const view = (i, top, rect) => [{ t: "bars", label: "heights（两头是哨兵 0）", items: H.map((v, k) => ({ v, cls: k === top ? "b" : k === i ? "a" : rect && k > rect[0] && k < rect[1] ? "w" : bestR && k > bestR[0] && k < bestR[1] && !rect ? "c" : stack.includes(k) ? "e" : (k === 0 || k === H.length - 1) ? "d" : "" })), ptrs: { i: i >= 0 ? i : null } },
      { t: "chips", label: "栈（存下标，右边是栈顶）", items: stack.map((k) => `${k}:${H[k]}`), empty: "空" }];
    snap("开始", "两头各加一根高度为 0 的哨兵柱子。栈里存下标，对应高度递增。", view(-1, -1), { at: "init", facts: [["最大面积", best]] });
    for (let i = 0; i < H.length; i++) {
      while (stack.length && H[stack[stack.length - 1]] > H[i]) {
        const top = stack.pop(), left = stack[stack.length - 1], area = H[top] * (i - left - 1);
        const better = area > best; if (better) { best = area; bestR = [left, i]; }
        snap("结算", `${H[i]} 比栈顶的 ${H[top]} 矮，以 ${H[top]} 为高的矩形右边到不了 ${i}，左边到不了新栈顶 ${left}。宽 ${i - left - 1}，面积 <b>${area}</b>${better ? "，是目前最大的" : ""}。`, view(i, top, [left, i]), { at: "pop", facts: [["最大面积", best]] });
      }
      stack.push(i);
      if (i > 0 && i < H.length - 1) snap("压栈", `${H[i]} 不比栈顶矮，压栈。`, view(i, -1), { at: "push", facts: [["最大面积", best]] });
    }
    snap("完成", `最大矩形面积是 <b>${best}</b>。`, view(-1, -1), { at: "done", kind: "ok", ans: best, facts: [["最大面积", best]] });
  },
  points: [
    { t: "宽度是 i − left − 1", body: "左右边界都是比它矮的柱子，本身不算在矩形里。" },
    { t: "相等的高度", body: "用 <code>&gt;</code> 弹出，相等的不弹。这样相等高度里靠左的那根会算少，但最右边那根结算时宽度是对的，答案不受影响。" },
    { t: "复杂度", body: "每根柱子进出栈各一次，时间 O(n)，空间 O(n)。" },
  ],
};
