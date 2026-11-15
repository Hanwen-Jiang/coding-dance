var numIslands = function(grid) {
    const m = grid.length, n = grid[0].length;                  //@init
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let count = 0;                                              //@init
    for (let i = 0; i < m; i++) {                               //@scan
        for (let j = 0; j < n; j++) {                           //@scan
            if (grid[i][j] !== '1') {
                continue;
            }
            count++;                                            //@found
            grid[i][j] = '0';                                   //@found
            const stack = [[i, j]];                             //@found
            while (stack.length) {
                const [x, y] = stack.pop();                     //@pop
                for (const [dx, dy] of dirs) {                  //@expand
                    const a = x + dx, b = y + dy;               //@expand
                    if (a >= 0 && a < m && b >= 0 && b < n && grid[a][b] === '1') {     //@expand
                        grid[a][b] = '0';                       // 入栈时就做记号 //@expand
                        stack.push([a, b]);                     //@expand
                    }
                }
            }
        }
    }
    return count;                                               //@done
};
