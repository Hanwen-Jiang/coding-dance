const F = require("../fig");

module.exports = {
  id: 74, name: "搜索二维矩阵", title: "搜索二维矩阵图解", level: "中等", topic: "二分查找",
  h1: "搜索二维矩阵，把它拉成一行",
  lede: "每行递增，并且每行第一个数比上一行最后一个数大。把矩阵一行接一行拼起来，就是一个有序数组。在这个虚拟数组上二分，一维下标 k 对应第 k // n 行、第 k % n 列。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "mat.jpg": [F.grid([[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], { label: "每行递增，每行第一个数比上一行最后一个数大。target = 3 在矩阵里", cls: (v) => (v === 3 ? "c" : "") })],
    "mat2.jpg": [F.grid([[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], { label: "target = 13 不在矩阵里（在 11 和 16 之间）", cls: (v) => (v === 11 || v === 16 ? "w" : "") })],
  },
  hints: [
    { t: "它其实是一个有序数组", body: ["第 0 行接第 1 行接第 2 行……拼起来整体是递增的。"] },
    { t: "下标怎么换算", body: ["矩阵有 <code>n</code> 列。一维下标 <code>k</code> 对应 <code>matrix[k // n][k % n]</code>。", "不用真的拼接，二分时现场换算就行。"] },
    { t: "另一种思路", body: ["先二分找到「最后一个行首 ≤ target」的行，再在这一行里二分。复杂度一样。"] },
  ],
  codes: [{ t: "标准解法：当成一维数组二分", code: `
class Solution:
    def searchMatrix(self, matrix: List[List[int]], target: int) -> bool:
        m, n = len(matrix), len(matrix[0])  #@init
        lo, hi = 0, m * n - 1               # 当成长度 m·n 的有序数组 #@init
        while lo <= hi:                     #@loop
            mid = (lo + hi) // 2            #@loop
            x = matrix[mid // n][mid % n]   # 一维下标换回行列 #@loop
            if x == target:                 #@found
                return True                 #@found
            if x < target:                  #@small
                lo = mid + 1                #@small
            else:                           #@big
                hi = mid - 1                #@big
        return False                        #@none
` }, { t: "简洁写法：bisect 加 key", kind: "elegant", note: "Python 3.10 起 bisect 支持 key 参数，range 不会真的生成列表。", code: `
from bisect import bisect_left

class Solution:
    def searchMatrix(self, matrix: List[List[int]], target: int) -> bool:
        m, n = len(matrix), len(matrix[0])
        k = bisect_left(range(m * n), target, key=lambda k: matrix[k // n][k % n])
        return k < m * n and matrix[k // n][k % n] == target
` }],
  sig: { fn: "searchMatrix", params: ["int[][]", "int"], ret: "bool" },
  call: (a) => [a.M, a.target],
  cases: [[[[1]], 1], [[[1]], 2], [[[1, 3]], 3], [[[1], [3]], 2], [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 60]],
  pytest: `
s = Solution()
M = [[1,3,5,7],[10,11,16,20],[23,30,34,60]]
assert s.searchMatrix(M, 3) is True
assert s.searchMatrix(M, 13) is False
assert s.searchMatrix(M, 60) is True
assert s.searchMatrix(M, 0) is False
assert s.searchMatrix(M, 61) is False
assert s.searchMatrix([[1]], 1) is True
`,
  legend: [["e", "还在搜索范围里"], ["a", "mid"], ["d", "已排除"], ["c", "找到"]],
  presets: [
    { label: "示例 1", args: { M: [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], target: 3 }, note: "target = 3", expect: true },
    { label: "示例 2", args: { M: [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], target: 13 }, note: "target = 13", expect: false },
  ],
  build(a, snap) {
    const M = a.M.map((r) => r.slice()), target = a.target, m = M.length, n = M[0].length;
    let lo = 0, hi = m * n - 1;
    const view = (mid, hit) => [{
      t: "grid",
      label: "matrix（第 i 行第 j 列的一维下标是 i·n + j）",
      rows: M.map((r, i) => r.map((v, j) => {
        const k = i * n + j;
        return { v, cls: k === hit ? "c" : k === mid ? "a" : k < lo || k > hi ? "d" : "e" };
      })),
    }];
    snap(
      "开始",
      `把 ${m}×${n} 的矩阵看成长度 ${m * n} 的有序数组，下标 0 到 ${m * n - 1}，在 [0, ${m * n - 1}] 上二分找 <b>${target}</b>。`,
      view(-1),
      { at: "init", facts: [["target", target], ["区间", `[${lo}, ${hi}]`], ["lo", lo], ["hi", hi]] },
    );
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, r = (mid / n) | 0, c = mid % n, x = M[r][c];
      snap(
        "计算 mid 并换算行列",
        `mid = (${lo} + ${hi}) // 2 = ${mid}，换算成第 ${r} 行第 ${c} 列（${mid} // ${n} = ${r}，${mid} % ${n} = ${c}），值为 <b>${x}</b>。`,
        view(mid),
        { at: "loop", facts: [["target", target], ["mid", `${mid} → (${r}, ${c})`], ["矩阵值", x], ["lo", lo], ["hi", hi]] },
      );
      if (x === target) {
        snap(
          "找到目标",
          `matrix[${r}][${c}] = ${x}，正好等于 ${target}，返回 <b>true</b>。`,
          view(-1, mid),
          { at: "found", kind: "ok", ans: true, facts: [["target", target], ["位置", `(${r}, ${c})`], ["结果", "true"]] },
        );
        return;
      }
      if (x < target) {
        const prevLo = lo, prevRange = `[${lo}, ${hi}]`;
        lo = mid + 1;
        snap(
          "太小，排除左半",
          `${x} &lt; ${target}，下标 ${prevLo}..${mid} 的数全部太小，排除掉！lo 右移到 ${lo}。`,
          view(-1),
          { at: "small", facts: [["target", target], ["区间", `[${lo}, ${hi}]`, prevRange], ["lo", lo, prevLo], ["hi", hi]] },
        );
      } else {
        const prevHi = hi, prevRange = `[${lo}, ${hi}]`;
        hi = mid - 1;
        snap(
          "太大，排除右半",
          `${x} &gt; ${target}，下标 ${mid}..${prevHi} 的数全部太大，排除掉！hi 左移到 ${hi}。`,
          view(-1),
          { at: "big", facts: [["target", target], ["区间", `[${lo}, ${hi}]`, prevRange], ["lo", lo], ["hi", hi, prevHi]] },
        );
      }
    }
    snap(
      "没找到",
      `lo = ${lo} &gt; hi = ${hi}，区间空了，矩阵里没有 ${target}，返回 <b>false</b>。`,
      view(-1),
      { at: "none", kind: "warn", ans: false, facts: [["target", target], ["lo", lo], ["hi", hi], ["结果", "false"]] },
    );
  },
  points: [
    { t: "除数是列数 n", body: "行号是 k // n，列号是 k % n。用成行数 m 会算错。" },
    { t: "和第 240 题区分", body: "240 题只保证每行、每列递增，行与行之间不连续，不能拉成一行，要从右上角走。" },
    { t: "复杂度", body: "时间 O(log(m·n))，空间 O(1)。" },
  ],
};
