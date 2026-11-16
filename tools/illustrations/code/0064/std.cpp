class Solution {
public:
    int minPathSum(vector<vector<int>>& grid) {
        int m = grid.size(), n = grid[0].size();        //@init
        vector<vector<int>> dp(m, vector<int>(n));      //@init
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < n; j++) {
                if (i == 0 && j == 0) {                 //@start
                    dp[i][j] = grid[0][0];              //@start
                } else if (i == 0) {                    //@row
                    dp[i][j] = dp[i][j - 1] + grid[i][j];   // 第一行只能从左边来 //@row
                } else if (j == 0) {                    //@col
                    dp[i][j] = dp[i - 1][j] + grid[i][j];   // 第一列只能从上面来 //@col
                } else {                                //@mid
                    dp[i][j] = min(dp[i - 1][j], dp[i][j - 1]) + grid[i][j];    //@mid
                }
            }
        }
        return dp[m - 1][n - 1];                        //@done
    }
};
