module.exports = {
  id: 54, name: "螺旋矩阵", title: "螺旋矩阵图解", level: "中等", topic: "矩阵",
  h1: "螺旋矩阵，四条边界一圈圈往里收",
  lede: "用上、下、左、右四个边界框住还没走过的部分。沿着上边走完，上边界就往下收一行；沿着右边走完，右边界就往左收一列。这样一圈圈收下去，直到边界交错。",
  hints: [
    { t: "用边界代替方向判断", body: ["不用记「走过哪些格子」。维护 <code>top</code>、<code>bottom</code>、<code>left</code>、<code>right</code> 四个边界，它们围住的是还没走的区域。"] },
    { t: "一圈分四段", body: ["上边：从左到右，走完 <code>top += 1</code>。", "右边：从上到下，走完 <code>right -= 1</code>。", "下边：从右到左，走完 <code>bottom -= 1</code>。左边：从下到上，走完 <code>left += 1</code>。"] },
    { t: "只剩一行或一列时", body: ["走完上边和右边后，区域可能已经空了。", "所以走下边之前要检查 <code>top &lt;= bottom</code>，走左边之前要检查 <code>left &lt;= right</code>，否则会把同一行或同一列再走一遍。"] },
  ],
  codes: [{ t: "标准解法：收缩边界", code: `
class Solution:
    def spiralOrder(self, matrix: List[List[int]]) -> List[int]:
        res = []
        top, bottom = 0, len(matrix) - 1
        left, right = 0, len(matrix[0]) - 1
        while top <= bottom and left <= right:
            for j in range(left, right + 1):        # 上边：左 -> 右
                res.append(matrix[top][j])
            top += 1
            for i in range(top, bottom + 1):        # 右边：上 -> 下
                res.append(matrix[i][right])
            right -= 1
            if top <= bottom:
                for j in range(right, left - 1, -1):    # 下边：右 -> 左
                    res.append(matrix[bottom][j])
                bottom -= 1
            if left <= right:
                for i in range(bottom, top - 1, -1):    # 左边：下 -> 上
                    res.append(matrix[i][left])
                left += 1
        return res
` }, { t: "简洁写法：取走第一行，再把剩下的转一下", kind: "elegant", note: "每次拿走第一行，把剩下的矩阵逆时针转 90°，新的第一行就是原来的右边一列。会改掉输入，时间 O((m·n)·min(m, n))。", code: `
class Solution:
    def spiralOrder(self, matrix: List[List[int]]) -> List[int]:
        res = []
        while matrix:
            res += matrix.pop(0)
            matrix = [list(r) for r in zip(*matrix)][::-1]
        return res
` }],
  pytest: `
s = Solution()
assert s.spiralOrder([[1,2,3],[4,5,6],[7,8,9]]) == [1,2,3,6,9,8,7,4,5]
assert s.spiralOrder([[1,2,3,4],[5,6,7,8],[9,10,11,12]]) == [1,2,3,4,8,12,11,10,9,5,6,7]
assert s.spiralOrder([[1,2,3]]) == [1,2,3]
assert s.spiralOrder([[1],[2],[3]]) == [1,2,3]
`,
  legend: [["a", "这一段刚走的"], ["d", "之前走过的"], ["e", "边界围住的未走区域"]],
  presets: [
    { label: "示例 1", args: { m: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }, note: "matrix = [[1,2,3],[4,5,6],[7,8,9]]", expect: [1, 2, 3, 6, 9, 8, 7, 4, 5] },
    { label: "示例 2", args: { m: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] }, note: "matrix = [[1,2,3,4],[5,6,7,8],[9,10,11,12]]", expect: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7] },
  ],
  build(a, snap) {
    const M = a.m, res = [], seen = M.map((r) => r.map(() => 0));
    let top = 0, bottom = M.length - 1, left = 0, right = M[0].length - 1;
    const view = () => [
      { t: "grid", label: "matrix", rows: M.map((r, i) => r.map((v, j) => ({ v, cls: seen[i][j] === 2 ? "a" : seen[i][j] === 1 ? "d" : i >= top && i <= bottom && j >= left && j <= right ? "e" : "" }))) },
      { t: "chips", label: "结果", items: res.slice(), empty: "还没有" },
    ];
    const facts = () => [["top", top], ["bottom", bottom], ["left", left], ["right", right]];
    const walk = (cells) => { for (const r of seen) for (let j = 0; j < r.length; j++) if (r[j] === 2) r[j] = 1; for (const [i, j] of cells) { seen[i][j] = 2; res.push(M[i][j]); } };
    snap("开始", "四个边界围住整个矩阵。", view(), { facts: facts() });
    while (top <= bottom && left <= right) {
      let c = []; for (let j = left; j <= right; j++) c.push([top, j]);
      walk(c); top++;
      snap("上边：左 → 右", `沿着上边界从左走到右，然后 top 下移到 ${top}。`, view(), { facts: facts() });
      c = []; for (let i = top; i <= bottom; i++) c.push([i, right]);
      walk(c); right--;
      snap("右边：上 → 下", c.length ? `沿着右边界从上走到下，然后 right 左移到 ${right}。` : `右边已经没有格子可走，right 左移到 ${right}。`, view(), { facts: facts() });
      if (top <= bottom) {
        c = []; for (let j = right; j >= left; j--) c.push([bottom, j]);
        walk(c); bottom--;
        snap("下边：右 → 左", c.length ? `top ≤ bottom，还有行。沿着下边界从右走到左，然后 bottom 上移到 ${bottom}。` : `下边没有格子可走，bottom 上移到 ${bottom}。`, view(), { facts: facts() });
      } else snap("跳过下边", "top 已经大于 bottom，没有剩余的行了。跳过下边，否则会把刚才那一行倒着再走一遍。", view(), { kind: "warn", facts: facts() });
      if (left <= right) {
        c = []; for (let i = bottom; i >= top; i--) c.push([i, left]);
        walk(c); left++;
        snap("左边：下 → 上", c.length ? `left ≤ right，还有列。沿着左边界从下走到上，然后 left 右移到 ${left}。` : `左边没有格子可走，left 右移到 ${left}。`, view(), { facts: facts() });
      } else snap("跳过左边", "left 已经大于 right，没有剩余的列了，跳过左边。", view(), { kind: "warn", facts: facts() });
    }
    walk([]);
    snap("完成", `边界交错，所有格子都走过了。结果是 [${res.join(", ")}]。`, view(), { kind: "ok", ans: res, facts: facts() });
  },
  points: [
    { t: "两个 if 不能省", body: "只有一行或一列的矩阵，少了这两个检查就会输出重复的数。" },
    { t: "走完立刻收边界", body: "每走完一条边就马上更新对应的边界，下一条边的起点自然避开了拐角。" },
    { t: "复杂度", body: "每个格子走一次，时间 O(m · n)。" },
  ],
};
