class Solution {
    private static final int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    private char[][] board;
    private String word;
    private int m, n;

    public boolean exist(char[][] board, String word) {
        this.board = board;
        this.word = word;
        m = board.length;                           //@init
        n = board[0].length;                        //@init
        for (int i = 0; i < m; i++) {               //@start
            for (int j = 0; j < n; j++) {           //@start
                if (dfs(i, j, 0)) {                 //@start
                    return true;                    //@yes
                }
            }
        }
        return false;                               //@no
    }

    private boolean dfs(int i, int j, int k) {
        if (board[i][j] != word.charAt(k)) {        //@match
            return false;
        }
        if (k == word.length() - 1) {               //@found
            return true;                            //@found
        }
        board[i][j] = '#';                          // 占住这个格子 //@match
        for (int[] d : DIRS) {                      //@match
            int x = i + d[0], y = j + d[1];         //@match
            if (x >= 0 && x < m && y >= 0 && y < n && dfs(x, y, k + 1)) {   //@match
                board[i][j] = word.charAt(k);
                return true;
            }
        }
        board[i][j] = word.charAt(k);               // 回溯：还原 //@back
        return false;                               //@back
    }
}
