class Solution {
    public int uniquePathsWithObstacles(int[][] obstacleGrid) {
        int n = obstacleGrid[0].length;
        int[] dp = new int[n];                  // 一行：第 -1 行（越界）全是 0 //@init
        dp[0] = 1;                              // 只给起点上面放一条路，起点就是 1 //@init
        for (int[] row : obstacleGrid) {        //@row
            for (int j = 0; j < n; j++) {
                if (row[j] == 1) {              // 障碍：清零 //@block
                    dp[j] = 0;                  //@block
                } else if (j > 0) {             // 原来的 dp[j] 是上面，dp[j-1] 是刚算好的左边 //@cell
                    dp[j] += dp[j - 1];         //@cell
                }
            }
        }
        return dp[n - 1];                       //@done
    }
}
