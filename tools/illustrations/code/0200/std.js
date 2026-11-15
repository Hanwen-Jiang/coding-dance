var numIslands = function(grid) {
    const m = grid.length, n = grid[0].length;      //@init
    const sink = (i, j) => {
        if (i < 0 || j < 0 || i >= m || j >= n || grid[i][j] !== '1') {
            return;                 // 越界或不是陆地
        }
        grid[i][j] = '0';           // 先做记号，再扩散 //@mark
        sink(i - 1, j);             //@spread
        sink(i + 1, j);             //@spread
        sink(i, j - 1);             //@spread
        sink(i, j + 1);             //@spread
    };
    let count = 0;                                  //@init
    for (let i = 0; i < m; i++) {                   //@scan
        for (let j = 0; j < n; j++) {               //@scan
            if (grid[i][j] === '1') {               //@found
                count++;                            //@found
                sink(i, j);                         //@found
            }
        }
    }
    return count;                                   //@done
};
