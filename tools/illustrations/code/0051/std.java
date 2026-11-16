class Solution {
    private int n;
    private int[] queens;                               // queens[r]：第 r 行皇后所在的列
    private boolean[] cols, diag1, diag2;               // diag1 用 r - c + n 当下标，避免负数
    private List<List<String>> res;

    public List<List<String>> solveNQueens(int n) {
        this.n = n;                                     //@init
        res = new ArrayList<>();                        //@init
        queens = new int[n];                            //@init
        cols = new boolean[n]; diag1 = new boolean[2 * n]; diag2 = new boolean[2 * n];  //@init
        dfs(0);                                         //@init
        return res;                                     //@done
    }

    private void dfs(int r) {
        if (r == n) {                                   //@found
            List<String> board = new ArrayList<>();     //@found
            for (int c : queens) {                      //@found
                board.add(".".repeat(c) + "Q" + ".".repeat(n - c - 1));     //@found
            }
            res.add(board);                             //@found
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
}
