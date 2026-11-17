func uniquePathsWithObstacles(obstacleGrid [][]int) int {
	m, n := len(obstacleGrid), len(obstacleGrid[0])
	dp := make([][]int, m) // dp[i][j]：走到 (i, j) 的路径数 //@init
	for i := range dp {    //@init
		dp[i] = make([]int, n) //@init
	}
	for i := 0; i < m; i++ {
		for j := 0; j < n; j++ {
			if obstacleGrid[i][j] == 1 { // 障碍：走不到 //@block
				dp[i][j] = 0 //@block
			} else if i == 0 && j == 0 { // 起点，直接给定 //@start
				dp[i][j] = 1 //@start
			} else { // 从上面来 + 从左边来，越界的当 0 //@cell
				up, left := 0, 0 //@cell
				if i > 0 {       //@cell
					up = dp[i-1][j] //@cell
				}
				if j > 0 { //@cell
					left = dp[i][j-1] //@cell
				}
				dp[i][j] = up + left //@cell
			}
		}
	}
	return dp[m-1][n-1] //@done
}
