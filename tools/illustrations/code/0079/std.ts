function exist(board: string[][], word: string): boolean {
    const m = board.length, n = board[0].length;    //@init
    const dfs = (i: number, j: number, k: number): boolean => {
        if (board[i][j] !== word[k]) {              //@match
            return false;
        }
        if (k === word.length - 1) {                //@found
            return true;                            //@found
        }
        board[i][j] = "#";                          // 占住这个格子 //@match
        for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {    //@match
            if (x >= 0 && x < m && y >= 0 && y < n && dfs(x, y, k + 1)) {           //@match
                board[i][j] = word[k];
                return true;
            }
        }
        board[i][j] = word[k];                      // 回溯：还原 //@back
        return false;                               //@back
    };
    for (let i = 0; i < m; i++) {                   //@start
        for (let j = 0; j < n; j++) {               //@start
            if (dfs(i, j, 0)) {                     //@start
                return true;                        //@yes
            }
        }
    }
    return false;                                   //@no
}
