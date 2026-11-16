var rotate = function(matrix) {
    const n = matrix.length;                        //@init
    for (let i = 0; i < n; i++) {                   //@swap
        for (let j = i + 1; j < n; j++) {           // 只换对角线上方的一半 //@swap
            [matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]];    //@swap
        }
    }
    for (const row of matrix) {                     //@flip
        row.reverse();                              //@flip
    }
};
