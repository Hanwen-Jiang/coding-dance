var setZeroes = function(matrix) {
    const m = matrix.length, n = matrix[0].length;
    const rows = new Set(), cols = new Set();       // 要清零的行、列
    for (let i = 0; i < m; i++) {                   //@find
        for (let j = 0; j < n; j++) {               //@find
            if (matrix[i][j] === 0) {               //@find
                rows.add(i);                        //@find
                cols.add(j);                        //@find
            }
        }
    }
    for (let i = 0; i < m; i++) {                   //@clear
        for (let j = 0; j < n; j++) {               //@clear
            if (rows.has(i) || cols.has(j)) {       //@clear
                matrix[i][j] = 0;                   //@clear
            }
        }
    }
};
