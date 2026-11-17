function orangesRotting(grid: number[][]): number {
    const m = grid.length, n = grid[0].length;      //@init
    let q: [number, number][] = [], fresh = 0;      //@init
    for (let i = 0; i < m; i++) {                   //@init
        for (let j = 0; j < n; j++) {               //@init
            if (grid[i][j] === 2) q.push([i, j]);   //@init
            if (grid[i][j] === 1) fresh++;          //@init
        }
    }
    let minutes = 0;                                //@init
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];    //@init
    while (q.length && fresh) {                     //@minute
        minutes++;                                  //@minute
        const next: [number, number][] = [];        // 这一分钟里所有烂橘子同时扩散 //@minute
        for (const [i, j] of q) {                   //@minute
            for (const [dx, dy] of dirs) {          //@minute
                const x = i + dx, y = j + dy;       //@minute
                if (x >= 0 && x < m && y >= 0 && y < n && grid[x][y] === 1) {   //@minute
                    grid[x][y] = 2;                 //@minute
                    fresh--;                        //@minute
                    next.push([x, y]);              //@minute
                }
            }
        }
        q = next;                                   //@minute
    }
    return fresh ? -1 : minutes;                    //@done
}
