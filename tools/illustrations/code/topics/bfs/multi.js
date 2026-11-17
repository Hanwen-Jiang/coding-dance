var updateMatrix = function(mat) {
    const m = mat.length, n = mat[0].length;
    const dist = mat.map((row) => row.map(() => -1));   // -1 表示还没走到 //@init
    const q = [];                                   //@init
    for (let i = 0; i < m; i++) {                   //@seed
        for (let j = 0; j < n; j++) {               //@seed
            if (mat[i][j] === 0) {                  // 所有的 0 同时作为起点 //@seed
                dist[i][j] = 0;                     //@seed
                q.push([i, j]);                     //@seed
            }
        }
    }
    for (let head = 0; head < q.length; ) {
        const [i, j] = q[head++];                   // 用下标出队，不用 shift //@pop
        for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {    //@next
            if (a >= 0 && a < m && b >= 0 && b < n && dist[a][b] === -1) {  //@next
                dist[a][b] = dist[i][j] + 1;        // 第一次走到就是最近的距离 //@next
                q.push([a, b]);                     //@next
            }
        }
    }
    return dist;                                    //@done
};
