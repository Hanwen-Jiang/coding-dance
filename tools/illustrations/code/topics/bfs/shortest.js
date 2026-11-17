var nearestExit = function(maze, entrance) {
    const m = maze.length, n = maze[0].length;
    const q = [[entrance[0], entrance[1], 0]];      // [行, 列, 走了几步] //@init
    maze[entrance[0]][entrance[1]] = "+";           // 走过的格子标成墙，不再走 //@init
    for (let head = 0; head < q.length; ) {
        const [i, j, d] = q[head++];                // 用下标出队，不用 shift //@pop
        for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {    //@next
            if (a >= 0 && a < m && b >= 0 && b < n && maze[a][b] === ".") {     //@next
                if (a === 0 || a === m - 1 || b === 0 || b === n - 1) {     // 到了边上：就是出口 //@exit
                    return d + 1;                   //@exit
                }
                maze[a][b] = "+";                   // 入队时就标记 //@push
                q.push([a, b, d + 1]);              //@push
            }
        }
    }
    return -1;                                      //@done
};
