module.exports = {
  id: 74, name: "搜索二维矩阵", title: "搜索二维矩阵图解", level: "中等", topic: "二分查找",
  h1: "搜索二维矩阵，把它拉成一行",
  lede: "每行递增，并且每行第一个数比上一行最后一个数大。把矩阵一行接一行拼起来，就是一个有序数组。在这个虚拟数组上二分，一维下标 k 对应第 k // n 行、第 k % n 列。",
  hints: [
    { t: "它其实是一个有序数组", body: ["第 0 行接第 1 行接第 2 行……拼起来整体是递增的。"] },
    { t: "下标怎么换算", body: ["矩阵有 <code>n</code> 列。一维下标 <code>k</code> 对应 <code>matrix[k // n][k % n]</code>。", "不用真的拼接，二分时现场换算就行。"] },
    { t: "另一种思路", body: ["先二分找到「最后一个行首 ≤ target」的行，再在这一行里二分。复杂度一样。"] },
  ],
  codes: [{ t: "标准解法：当成一维数组二分", code: `
class Solution:
    def searchMatrix(self, matrix: List[List[int]], target: int) -> bool:
        m, n = len(matrix), len(matrix[0])
        lo, hi = 0, m * n - 1               # 当成长度 m·n 的有序数组
        while lo <= hi:
            mid = (lo + hi) // 2
            x = matrix[mid // n][mid % n]   # 一维下标换回行列
            if x == target:
                return True
            if x < target:
                lo = mid + 1
            else:
                hi = mid - 1
        return False
` }, { t: "简洁写法：bisect 加 key", kind: "elegant", note: "Python 3.10 起 bisect 支持 key 参数，range 不会真的生成列表。", code: `
from bisect import bisect_left

class Solution:
    def searchMatrix(self, matrix: List[List[int]], target: int) -> bool:
        m, n = len(matrix), len(matrix[0])
        k = bisect_left(range(m * n), target, key=lambda k: matrix[k // n][k % n])
        return k < m * n and matrix[k // n][k % n] == target
` }],
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
    const { M, target } = a, m = M.length, n = M[0].length;
    let lo = 0, hi = m * n - 1;
    const view = (mid, hit) => [{ t: "grid", label: "matrix（第 i 行第 j 列的一维下标是 i·n + j）", rows: M.map((r, i) => r.map((v, j) => { const k = i * n + j; return { v, cls: k === hit ? "c" : k === mid ? "a" : k < lo || k > hi ? "d" : "e" }; })) }];
    const f = (mid) => ({ facts: [["lo", lo], ["hi", hi], ["mid", mid >= 0 ? `${mid} → (${(mid / n) | 0}, ${mid % n})` : "—"]] });
    snap("开始", `把 ${m}×${n} 的矩阵看成长度 ${m * n} 的有序数组，下标 0 到 ${m * n - 1}。找 <b>${target}</b>。`, view(-1), f(-1));
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, x = M[(mid / n) | 0][mid % n];
      if (x === target) { snap("找到", `下标 ${mid} 对应第 ${(mid / n) | 0} 行第 ${mid % n} 列，值是 ${x}，找到了，返回 <b>true</b>。`, view(-1, mid), { kind: "ok", ans: true, ...f(mid) }); return; }
      snap(x < target ? "太小" : "太大", `mid = ${mid}，换成行列是 (${(mid / n) | 0}, ${mid % n})，值是 ${x}，比 ${target} ${x < target ? "小，去右半边" : "大，去左半边"}。`, view(mid), f(mid));
      if (x < target) lo = mid + 1; else hi = mid - 1;
    }
    snap("没找到", `lo = ${lo} &gt; hi = ${hi}，范围空了，矩阵里没有 ${target}，返回 <b>false</b>。`, view(-1), { kind: "warn", ans: false, ...f(-1) });
  },
  points: [
    { t: "除数是列数 n", body: "行号是 k // n，列号是 k % n。用成行数 m 会算错。" },
    { t: "和第 240 题区分", body: "240 题只保证每行、每列递增，行与行之间不连续，不能拉成一行，要从右上角走。" },
    { t: "复杂度", body: "时间 O(log(m·n))，空间 O(1)。" },
  ],
};
