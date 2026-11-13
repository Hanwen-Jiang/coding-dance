module.exports = {
  id: 73, name: "矩阵置零", title: "矩阵置零图解", level: "中等", topic: "矩阵",
  h1: "矩阵置零，用第一行和第一列做记号",
  lede: "不能边扫边置零，否则新写的 0 会被当成原来的 0 继续扩散。要先记下哪些行和列需要清零。为了不占额外空间，记号就写在矩阵自己的第一行和第一列上。",
  hints: [
    { t: "为什么不能直接改", body: ["扫到一个 0 就把整行整列置零的话，后面扫到这些新写的 0，分不清它们是原来就有的还是刚写上去的。", "所以要分两步：先记录，再清零。"] },
    { t: "最直接的记录方式", body: ["用两个集合分别记下「哪些行有 0」「哪些列有 0」，再扫一遍把这些行列清零。额外空间 <code>O(m + n)</code>。"] },
    { t: "把记号写进矩阵里", body: ["用第一行记录每一列要不要清零，用第一列记录每一行要不要清零。", "但第一行、第一列自己原来有没有 0 会被记号盖掉，所以要先用两个变量单独记下来，最后再处理它们。"] },
  ],
  codes: [{ t: "标准解法：第一行、第一列做标记", code: `
class Solution:
    def setZeroes(self, matrix: List[List[int]]) -> None:
        m, n = len(matrix), len(matrix[0])
        row0 = any(matrix[0][j] == 0 for j in range(n))   # 第一行原来有没有 0
        col0 = any(matrix[i][0] == 0 for i in range(m))   # 第一列原来有没有 0
        for i in range(1, m):
            for j in range(1, n):
                if matrix[i][j] == 0:
                    matrix[i][0] = matrix[0][j] = 0       # 做记号
        for i in range(1, m):
            for j in range(1, n):
                if matrix[i][0] == 0 or matrix[0][j] == 0:
                    matrix[i][j] = 0
        if row0:
            for j in range(n):
                matrix[0][j] = 0
        if col0:
            for i in range(m):
                matrix[i][0] = 0
` }, { t: "简洁写法：记下要清零的行和列（O(m+n) 空间）", kind: "elegant", note: "先找出所有含 0 的行和列，再统一清零。好写，但用了额外空间，题目进阶要求 O(1)。", code: `
class Solution:
    def setZeroes(self, matrix: List[List[int]]) -> None:
        rows = {i for i, r in enumerate(matrix) if 0 in r}
        cols = {j for j, c in enumerate(zip(*matrix)) if 0 in c}
        for i, r in enumerate(matrix):
            for j in range(len(r)):
                if i in rows or j in cols:
                    r[j] = 0
` }],
  pytest: `
for a, e in [([[1,1,1],[1,0,1],[1,1,1]], [[1,0,1],[0,0,0],[1,0,1]]), ([[0,1,2,0],[3,4,5,2],[1,3,1,5]], [[0,0,0,0],[0,4,5,0],[0,3,1,0]]), ([[1,0]], [[0,0]]), ([[1],[0]], [[0],[0]])]:
    Solution().setZeroes(a); assert a == e
`,
  legend: [["a", "正在看的格子"], ["w", "写下的记号"], ["c", "被清零的格子"], ["e", "记号区（第一行、第一列）"]],
  presets: [
    { label: "示例 1", args: { m: [[1, 1, 1], [1, 0, 1], [1, 1, 1]] }, note: "matrix = [[1,1,1],[1,0,1],[1,1,1]]", expect: [[1, 0, 1], [0, 0, 0], [1, 0, 1]] },
    { label: "示例 2", args: { m: [[0, 1, 2, 0], [3, 4, 5, 2], [1, 3, 1, 5]] }, note: "matrix = [[0,1,2,0],[3,4,5,2],[1,3,1,5]]", expect: [[0, 0, 0, 0], [0, 4, 5, 0], [0, 3, 1, 0]] },
    { label: "里面有两个 0", args: { m: [[1, 2, 3, 4], [5, 0, 7, 8], [9, 10, 11, 0], [13, 14, 15, 16]] }, note: "matrix = [[1,2,3,4],[5,0,7,8],[9,10,11,0],[13,14,15,16]]", expect: [[1, 0, 3, 0], [0, 0, 0, 0], [0, 0, 0, 0], [13, 0, 15, 0]] },
  ],
  build(a, snap) {
    const M = a.m.map((r) => r.slice()), m = M.length, n = M[0].length, cls = M.map((r) => r.map(() => ""));
    const view = (ci, cj) => [{ t: "grid", label: "matrix", rows: M.map((r, i) => r.map((v, j) => ({ v, cls: i === ci && j === cj ? "a" : cls[i][j] || (i === 0 || j === 0 ? "e" : "") }))) }];
    const row0 = M[0].includes(0), col0 = M.some((r) => r[0] === 0);
    const facts = () => [["row0", row0 ? "有 0" : "没有"], ["col0", col0 ? "有 0" : "没有"]];
    snap("先记住第一行和第一列", `第一行和第一列马上要用来写记号，先看它们原来有没有 0：第一行${row0 ? "有" : "没有"}，第一列${col0 ? "有" : "没有"}。`, view(), { facts: facts() });
    for (let i = 1; i < m; i++) for (let j = 1; j < n; j++) if (M[i][j] === 0) {
      M[i][0] = 0; M[0][j] = 0; cls[i][0] = "w"; cls[0][j] = "w";
      snap("做记号", `matrix[${i}][${j}] 是 0。在这一行的开头 matrix[${i}][0] 和这一列的开头 matrix[0][${j}] 各写一个 0 作为记号。`, view(i, j), { facts: facts() });
    }
    let changed = 0;
    for (let i = 1; i < m; i++) for (let j = 1; j < n; j++) if (M[i][0] === 0 || M[0][j] === 0) { if (M[i][j] !== 0) changed++; M[i][j] = 0; cls[i][j] = "c"; }
    snap("按记号清零", `再扫一遍里面的格子：所在行的开头或所在列的开头是 0，就清零。`, view(), { facts: facts() });
    if (row0) for (let j = 0; j < n; j++) { M[0][j] = 0; cls[0][j] = "c"; }
    if (col0) for (let i = 0; i < m; i++) { M[i][0] = 0; cls[i][0] = "c"; }
    snap("最后处理第一行和第一列", (row0 ? "第一行原来有 0，整行清零。" : "第一行原来没有 0，保持不动。") + (col0 ? "第一列原来有 0，整列清零。" : "第一列原来没有 0，保持不动。"), view(), { facts: facts() });
    snap("完成", "所有该清零的行和列都处理完了。", view(), { kind: "ok", ans: M, facts: facts() });
  },
  points: [
    { t: "顺序不能乱", body: "先记 row0 / col0，再用第一行第一列做记号，最后才清第一行第一列。提前清掉的话，记号就全变成 0 了。" },
    { t: "内层从 1 开始", body: "做记号和按记号清零时，i、j 都从 1 开始，第一行第一列留到最后单独处理。" },
    { t: "复杂度", body: "时间 O(m · n)，额外空间 O(1)。" },
  ],
};
