func uniquePaths(m int, n int) int {
	dp := make([][]int, m) //@init
	for i := range dp {    // 第一行、第一列都只有 1 种走法 //@init
		dp[i] = make([]int, n) //@init
		for j := range dp[i] { //@init
			dp[i][j] = 1 //@init
		}
	}
	for i := 1; i < m; i++ {
		for j := 1; j < n; j++ {
			dp[i][j] = dp[i-1][j] + dp[i][j-1] // 从上面来 + 从左边来 //@cell
		}
	}
	return dp[m-1][n-1] //@done
}
