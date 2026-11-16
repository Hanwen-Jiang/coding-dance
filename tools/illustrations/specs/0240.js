module.exports = {
  id: 240, name: "搜索二维矩阵 II", title: "搜索二维矩阵 II 图解", level: "中等", topic: "矩阵",
  h1: "搜索二维矩阵 II，从右上角出发",
  lede: "站在右上角：往左走数变小，往下走数变大。每比较一次，就能排除掉一整行或者一整列，像在一棵二叉搜索树上找数。",
  hints: [
    { t: "用上两个方向的有序", body: ["每行从左到右递增，每列从上到下递增。", "只对每行做二分也能过（<code>O(m log n)</code>），但没有用上列的有序。"] },
    { t: "找一个好的起点", body: ["左上角：往右往下都是变大，没法判断该往哪走。", "<strong>右上角</strong>：往左变小，往下变大。两个方向效果相反，每次比较都能做出决定。左下角也一样。"] },
    { t: "每次排除一行或一列", body: ["当前的数比 target 大：它下面的数更大，这一整列都不可能，往左走。", "当前的数比 target 小：它左边的数更小，这一整行都不可能，往下走。"] },
  ],
  codes: [{ t: "标准解法：从右上角走", kind: "elegant", code: `
class Solution:
    def searchMatrix(self, matrix: List[List[int]], target: int) -> bool:
        i, j = 0, len(matrix[0]) - 1    # 右上角 #@init
        while i < len(matrix) and j >= 0:
            x = matrix[i][j]            #@cmp
            if x == target:             #@found
                return True             #@found
            if x > target:              #@left
                j -= 1                  # 这一列都太大 #@left
            else:
                i += 1                  # 这一行都太小 #@down
        return False                    #@none
` }],
  pytest: `
M = [[1,4,7,11,15],[2,5,8,12,19],[3,6,9,16,22],[10,13,14,17,24],[18,21,23,26,30]]
s = Solution()
assert s.searchMatrix(M, 5) is True
assert s.searchMatrix(M, 20) is False
assert s.searchMatrix([[1]], 1) is True
assert s.searchMatrix([[1]], 2) is False
assert all(s.searchMatrix(M, v) for r in M for v in r)
`,
  sig: { fn: "searchMatrix", params: ["int[][]", "int"], ret: "bool" },
  // 演示里的矩阵是固定的，只有 target 会变
  call: (a) => [[[1, 4, 7, 11, 15], [2, 5, 8, 12, 19], [3, 6, 9, 16, 22], [10, 13, 14, 17, 24], [18, 21, 23, 26, 30]], a.t],
  cases: [[[[1]], 1], [[[1]], 2], [[[-5]], -5], [[[1, 3, 5]], 4], [[[1], [3], [5]], 5], [[[1, 4], [2, 5]], 2], [[[1, 4], [2, 5]], 6]],
  legend: [["a", "当前位置"], ["d", "已排除的行和列"], ["c", "找到了"]],
  presets: [
    { label: "示例 1：找 5", args: { t: 5 }, note: "target = 5", expect: true },
    { label: "示例 2：找 20", args: { t: 20 }, note: "target = 20", expect: false },
    { label: "找 18", args: { t: 18 }, note: "target = 18", expect: true },
  ],
  build(a, snap) {
    const M = [[1, 4, 7, 11, 15], [2, 5, 8, 12, 19], [3, 6, 9, 16, 22], [10, 13, 14, 17, 24], [18, 21, 23, 26, 30]], t = a.t;
    let i = 0, j = M[0].length - 1;
    const view = (hit) => [{ t: "grid", label: "matrix", rows: M.map((r, x) => r.map((v, y) => ({ v, cls: x === i && y === j ? (hit ? "c" : "a") : x < i || y > j ? "d" : "" }))) }];
    snap("开始", `要找 <b>${t}</b>。从右上角 ${M[i][j]} 出发：往左数变小，往下数变大。`, view(), { at: "init", facts: [["target", t]] });
    while (i < M.length && j >= 0) {
      const x = M[i][j];
      if (x === t) { snap("找到", `当前是 ${x}，等于 target。返回 true。`, view(true), { at: ["cmp", "found"], kind: "ok", ans: true, facts: [["target", t]] }); return; }
      if (x > t) { snap("往左", `当前是 ${x}，比 ${t} 大。它下面的数都更大，<b>这一列全部排除</b>，往左走。`, view(), { at: ["cmp", "left"], facts: [["target", t]] }); j--; }
      else { snap("往下", `当前是 ${x}，比 ${t} 小。它左边的数都更小，<b>这一行全部排除</b>，往下走。`, view(), { at: ["cmp", "down"], facts: [["target", t]] }); i++; }
    }
    snap("没找到", `走出了矩阵，所有行和列都被排除。${t} 不在矩阵里，返回 false。`, view(), { at: "none", kind: "warn", ans: false, facts: [["target", t]] });
  },
  points: [
    { t: "起点只能是右上或左下", body: "这两个角上，两个移动方向一个变大一个变小。另外两个角做不到。" },
    { t: "循环条件", body: "<code>i</code> 往下走不能超过行数，<code>j</code> 往左走不能小于 0。" },
    { t: "复杂度", body: "最多走 m + n 步，时间 O(m + n)，空间 O(1)。" },
  ],
};
