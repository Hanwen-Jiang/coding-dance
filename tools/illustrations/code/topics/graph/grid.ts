function islandPerimeter(grid: number[][]): number {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];    // 上下左右 //@init
    const m = grid.length, n = grid[0].length;          //@init
    let ans = 0;                                        //@init
    for (let i = 0; i < m; i++) {                       //@cell
        for (let j = 0; j < n; j++) {                   //@cell
            if (grid[i][j] === 0) {                     //@cell
                continue;                               //@cell
            }
            for (const [di, dj] of dirs) {              //@dir
                const a = i + di, b = j + dj;           // 邻居的坐标 //@dir
                if (a < 0 || a >= m || b < 0 || b >= n || grid[a][b] === 0) {   // 出界或者是水 //@edge
                    ans++;                              // 这条边是周长 //@edge
                }
            }
        }
    }
    return ans;                                         //@done
}
