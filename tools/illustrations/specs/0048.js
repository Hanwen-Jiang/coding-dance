const F = require("../fig");

module.exports = {
  id: 48, name: "旋转图像", title: "旋转图像图解", level: "中等", topic: "矩阵",
  h1: "旋转图像，先沿对角线翻，再左右翻",
  lede: "直接算每个数转到哪里容易绕晕。顺时针转 90 度可以拆成两步简单的操作：先沿主对角线翻转（转置），再把每一行左右翻转。两步都是原地交换。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "mat1.jpg": [F.row([F.grid([[1, 2, 3], [4, 5, 6], [7, 8, 9]], { cls: (v, i) => (i === 0 ? "e" : "") }), F.grid([[7, 4, 1], [8, 5, 2], [9, 6, 3]], { cls: (v, i, j) => (j === 2 ? "e" : "") })], { label: "顺时针转 90°：第一行变成最后一列" })],
    "mat2.jpg": [F.row([F.grid([[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]], { cls: (v, i) => (i === 0 ? "e" : "") }), F.grid([[15, 13, 2, 5], [14, 3, 4, 1], [12, 6, 8, 9], [16, 7, 10, 11]], { cls: (v, i, j) => (j === 3 ? "e" : "") })], { label: "顺时针转 90°：第一行变成最后一列" })],
  },
  hints: [
    { t: "看一个数去了哪", body: ["顺时针转 90 度后，<code>matrix[i][j]</code> 会到 <code>matrix[j][n−1−i]</code>：原来的第 i 行变成了倒数第 i 列。"] },
    { t: "拆成两步", body: ["转置：<code>(i, j) → (j, i)</code>，行变成列。", "每行左右翻转：<code>(j, i) → (j, n−1−i)</code>。合起来正好是 <code>(i, j) → (j, n−1−i)</code>。"] },
    { t: "转置只换一半", body: ["转置时只遍历对角线上方的格子（<code>j &gt; i</code>），和对角线下方对应的格子交换。", "如果全部遍历，每一对会被交换两次，等于没换。"] },
  ],
  codes: [{ t: "标准解法：转置 + 每行翻转", code: `
class Solution:
    def rotate(self, matrix: List[List[int]]) -> None:
        n = len(matrix)                 #@init
        for i in range(n):              #@swap
            for j in range(i + 1, n):   # 只换对角线上方的一半 #@swap
                matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]  #@swap
        for row in matrix:              #@flip
            row.reverse()               #@flip
` }, { t: "简洁写法：zip 一行", key: "zip", kind: "elegant", note: "先上下翻转，再转置，等于顺时针旋转 90°。matrix[:] 赋值才是原地修改。", code: `
class Solution:
    def rotate(self, matrix: List[List[int]]) -> None:
        matrix[:] = [list(row) for row in zip(*matrix[::-1])]  #@flip,col
` }],
  sig: { fn: "rotate", params: ["int[][]"], ret: "void" },
  call: (a) => [a.m],
  cases: [[[[1]]], [[[1, 2], [3, 4]]]],
  pytest: `
for a, e in [([[1,2,3],[4,5,6],[7,8,9]], [[7,4,1],[8,5,2],[9,6,3]]), ([[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]], [[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]]), ([[1]], [[1]])]:
    Solution().rotate(a); assert a == e
`,
  method: "转置 + 每行翻转",
  legend: [["a", "正在交换的一对"], ["e", "主对角线"], ["k", "已翻转的行"]],
  presets: [
    { label: "示例 1", args: { m: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }, note: "matrix = [[1,2,3],[4,5,6],[7,8,9]]", expect: [[7, 4, 1], [8, 5, 2], [9, 6, 3]] },
    { label: "示例 2", args: { m: [[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]] }, note: "matrix = [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]", expect: [[15, 13, 2, 5], [14, 3, 4, 1], [12, 6, 8, 9], [16, 7, 10, 11]] },
  ],
  build(a, snap) {
    const M = a.m.map((r) => r.slice()), n = M.length; let rowsDone = 0, phase = 1;
    const view = (opts = {}) => {
      const p = opts.p, q = opts.q, prevMap = opts.prevMap || {}, activeRow = opts.activeRow;
      return [{
        t: "grid",
        label: "matrix",
        rows: M.map((r, i) => r.map((v, j) => ({
          v,
          ...(prevMap[`${i},${j}`] !== undefined ? { prev: prevMap[`${i},${j}`] } : {}),
          cls: (p && p[0] === i && p[1] === j) || (q && q[0] === i && q[1] === j)
            ? "a"
            : activeRow === i
              ? "a"
              : i < rowsDone
                ? "k"
                : phase === 1 && i === j
                  ? "e"
                  : "",
        }))),
        swaps: opts.swaps || [],
      }];
    };
    snap("开始", "第一步：沿主对角线（左上到右下）翻转。对角线上的数不动。", view(), { at: "init", facts: [["阶段", "1. 沿主对角线转置"], ["矩阵大小", `${n} × ${n}`]] });
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const oldA = M[i][j], oldB = M[j][i], diff = oldA !== oldB;
      [M[i][j], M[j][i]] = [M[j][i], M[i][j]];
      snap(
        "转置",
        `交换 matrix[${i}][${j}]（${oldA}）和 matrix[${j}][${i}]（${oldB}），它们关于对角线对称。`,
        view({
          p: [i, j],
          q: [j, i],
          swaps: [[[i, j], [j, i]]],
          prevMap: diff ? { [`${i},${j}`]: oldA, [`${j},${i}`]: oldB } : {},
        }),
        { at: "swap", facts: [["阶段", "1. 沿主对角线转置"], ["交换对", `(${i}, ${j}) ↔ (${j}, ${i})`]] },
      );
    }
    phase = 2;
    snap("转置完成", "现在原来的每一行变成了一列。第二步：把每一行左右翻转。", view(), { at: [], facts: [["阶段", "2. 每行左右翻转", "1. 沿主对角线转置"], ["已完成行数", `0 / ${n}`]] });
    for (let i = 0; i < n; i++) {
      const oldRow = M[i].slice();
      const rowSwaps = [];
      const prevMap = {};
      for (let c = 0; c < Math.floor(n / 2); c++) {
        const c2 = n - 1 - c;
        rowSwaps.push([[i, c], [i, c2]]);
        if (oldRow[c] !== oldRow[c2]) {
          prevMap[`${i},${c}`] = oldRow[c];
          prevMap[`${i},${c2}`] = oldRow[c2];
        }
      }
      M[i].reverse(); rowsDone = i + 1;
      snap(
        "翻转每一行",
        `第 ${i} 行左右翻转，变成 [${M[i].join(", ")}]。`,
        view({ activeRow: i, swaps: rowSwaps, prevMap }),
        { at: "flip", facts: [["阶段", "2. 每行左右翻转"], ["当前行", i], ["已完成行数", `${rowsDone} / ${n}`, `${rowsDone - 1} / ${n}`]] },
      );
    }
    snap("完成", "两步做完，矩阵顺时针旋转了 90 度。", view(), { at: [], kind: "ok", ans: M.map((r) => r.slice()), facts: [["阶段", "完成", "2. 每行左右翻转"], ["已完成行数", `${n} / ${n}`]] });
  },
  alts: [{
    t: "上下翻转 + zip",
    code: "zip",
    note: "和简洁写法一样：先上下翻转（matrix[::-1]），再用 zip(*rows) 转置。zip 每次从每一行各取一个数，凑成新的一行。",
    legend: [["a", "zip 这一次取的一列"], ["c", "得到的新一行"]],
    build(a, snap) {
      const M = a.m.map((r) => r.slice()), n = M.length, F = M.slice().reverse().map((r) => r.slice()), out = [];
      const grid = (label, rows, hl, prevMap = {}) => ({
        t: "grid",
        label,
        rows: rows.map((r, i) => r.map((v, j) => ({
          v,
          ...(prevMap[`${i},${j}`] !== undefined ? { prev: prevMap[`${i},${j}`] } : {}),
          cls: hl(i, j),
        }))),
      });
      snap("开始", "顺时针转 90° 等于：先上下翻转，再沿主对角线转置。", [grid("matrix", M, () => "")], { at: [], facts: [["步骤", "原矩阵"], ["已生成行数", `0 / ${n}`]] });
      const flipPrev = {};
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (F[i][j] !== M[i][j]) flipPrev[`${i},${j}`] = M[i][j];
      }
      snap("上下翻转", `matrix[::-1]：行的顺序倒过来，原来的最后一行 [${F[0].join(", ")}] 成了第一行。`, [grid("matrix[::-1]", F, () => "", flipPrev)], { at: "flip", facts: [["步骤", "1. matrix[::-1] 上下翻转", "原矩阵"], ["已生成行数", `0 / ${n}`]] });
      for (let j = 0; j < n; j++) {
        const colVals = F.map((r) => r[j]);
        out.push(colVals);
        const snapOut = out.map((r) => r.slice());
        snap(
          "zip 出一行",
          `zip 从翻转后的每一行各取第 ${j} 个数，得到 [${colVals.join(", ")}]，作为结果的第 ${j} 行。`,
          [grid("matrix[::-1]", F, (i, jj) => (jj === j ? "a" : "")), grid("结果", snapOut, (i) => (i === j ? "c" : ""))],
          { at: "col", facts: [["步骤", "2. zip 取列成行", j === 0 ? "1. matrix[::-1] 上下翻转" : "2. zip 取列成行"], ["当前列 j", j, j > 0 ? j - 1 : undefined], ["已生成行数", `${out.length} / ${n}`, `${out.length - 1} / ${n}`]] },
        );
      }
      const finalOut = out.map((r) => r.slice());
      snap("完成", "matrix[:] = … 把结果写回原来的列表对象，矩阵顺时针旋转了 90°。", [grid("matrix", finalOut, () => "")], { at: "col", kind: "ok", ans: finalOut, facts: [["步骤", "完成", "2. zip 取列成行"], ["已生成行数", `${n} / ${n}`]] });
    },
  }],
  points: [
    { t: "内层从 i + 1 开始", body: "转置时 <code>j</code> 从 <code>i + 1</code> 开始。从 0 开始会把每一对换两次。" },
    { t: "逆时针怎么转", body: "把第二步改成上下翻转（整体把行的顺序倒过来），就是逆时针 90 度。" },
    { t: "复杂度", body: "时间 O(n²)，额外空间 O(1)。" },
  ],
};
