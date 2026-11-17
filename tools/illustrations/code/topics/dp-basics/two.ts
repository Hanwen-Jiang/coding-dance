function uniquePathsWithObstacles(obstacleGrid: number[][]): number {
    const m = obstacleGrid.length, n = obstacleGrid[0].length;
    const dp: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));  // dp[i][j]：走到 (i, j) 的路径数 //@init
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (obstacleGrid[i][j] === 1) {     // 障碍：走不到 //@block
                dp[i][j] = 0;                   //@block
            } else if (i === 0 && j === 0) {    // 起点，直接给定 //@start
                dp[i][j] = 1;                   //@start
            } else {                            // 从上面来 + 从左边来，越界的当 0 //@cell
                dp[i][j] = (i > 0 ? dp[i - 1][j] : 0) + (j > 0 ? dp[i][j - 1] : 0);    //@cell
            }
        }
    }
    return dp[m - 1][n - 1];                    //@done
}
