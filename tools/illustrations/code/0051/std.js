var solveNQueens = function(n) {
    const res = [], queens = [];                    // queens[r]：第 r 行皇后所在的列 //@init
    const cols = new Set(), diag1 = new Set(), diag2 = new Set();   //@init
    const dfs = (r) => {
        if (r === n) {                              //@found
            res.push(queens.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1)));  //@found
            return;                                 //@found
        }
        for (let c = 0; c < n; c++) {               //@place
            if (cols.has(c) || diag1.has(r - c) || diag2.has(r + c)) {  //@place
                continue;                           // 同列或同一条斜线上已经有皇后 //@place
            }
            queens.push(c);                         //@place
            cols.add(c); diag1.add(r - c); diag2.add(r + c);    //@place
            dfs(r + 1);                             //@place
            queens.pop();                           //@back
            cols.delete(c); diag1.delete(r - c); diag2.delete(r + c);   //@back
        }
    };
    dfs(0);                                         //@init
    return res;                                     //@done
};
