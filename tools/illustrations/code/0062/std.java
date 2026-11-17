class Solution {
    public int uniquePaths(int m, int n) {
        int[][] dp = new int[m][n];                 //@init
        for (int[] row : dp) {                      // 第一行、第一列都只有 1 种走法 //@init
            Arrays.fill(row, 1);                    //@init
        }
        for (int i = 1; i < m; i++) {
            for (int j = 1; j < n; j++) {
                dp[i][j] = dp[i - 1][j] + dp[i][j - 1];     // 从上面来 + 从左边来 //@cell
            }
        }
        return dp[m - 1][n - 1];                    //@done
    }
}
