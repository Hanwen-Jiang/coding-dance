/**
 Do not return anything, modify matrix in-place instead.
 */
function rotate(matrix: number[][]): void {
    const n = matrix.length;
    const flip = matrix.map((row) => [...row]).reverse();   // 上下翻转 //@flip
    for (let j = 0; j < n; j++) {                   // 结果的第 j 行 = 翻转后的第 j 列 //@col
        matrix[j] = flip.map((row) => row[j]);      //@col
    }
}
