class Solution {
public:
    vector<vector<string>> solveNQueens(int n) {
        this->n = n;                                    //@init
        res.clear();                                    //@init
        queens.assign(n, 0);                            //@init
        cols.assign(n, false); diag1.assign(2 * n, false); diag2.assign(2 * n, false);  //@init
        dfs(0);                                         //@init
        return res;                                     //@done
    }

private:
    int n;
    vector<int> queens;                                 // queens[r]：第 r 行皇后所在的列
    vector<bool> cols, diag1, diag2;                    // diag1 用 r - c + n 当下标，避免负数
    vector<vector<string>> res;

    void dfs(int r) {
        if (r == n) {                                   //@found
            vector<string> board;                       //@found
            for (int c : queens) {                      //@found
                board.push_back(string(c, '.') + "Q" + string(n - c - 1, '.'));    //@found
            }
            res.push_back(board);                       //@found
            return;                                     //@found
        }
        for (int c = 0; c < n; c++) {                   //@place
            if (cols[c] || diag1[r - c + n] || diag2[r + c]) {  //@place
                continue;                               // 同列或同一条斜线上已经有皇后 //@place
            }
            queens[r] = c;                              //@place
            cols[c] = diag1[r - c + n] = diag2[r + c] = true;   //@place
            dfs(r + 1);                                 //@place
            cols[c] = diag1[r - c + n] = diag2[r + c] = false;  //@back
        }
    }
};
