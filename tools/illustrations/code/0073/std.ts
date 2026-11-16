function setZeroes(matrix: number[][]): void {
    const m = matrix.length, n = matrix[0].length;  //@first
    const row0 = matrix[0].some((v) => v === 0);    // 第一行原来有没有 0 //@first
    const col0 = matrix.some((r) => r[0] === 0);    // 第一列原来有没有 0 //@first
    for (let i = 1; i < m; i++) {
        for (let j = 1; j < n; j++) {
            if (matrix[i][j] === 0) {               //@mark
                matrix[i][0] = matrix[0][j] = 0;    // 做记号 //@mark
            }
        }
    }
    for (let i = 1; i < m; i++) {                   //@clear
        for (let j = 1; j < n; j++) {               //@clear
            if (matrix[i][0] === 0 || matrix[0][j] === 0) {     //@clear
                matrix[i][j] = 0;                   //@clear
            }
        }
    }
    if (row0) {                                     //@edge
        for (let j = 0; j < n; j++) {               //@edge
            matrix[0][j] = 0;                       //@edge
        }
    }
    if (col0) {                                     //@edge
        for (let i = 0; i < m; i++) {               //@edge
            matrix[i][0] = 0;                       //@edge
        }
    }
}
