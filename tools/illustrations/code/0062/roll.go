func uniquePaths(m int, n int) int {
	dp := make([]int, n) // 第 0 行：全是 1 //@init
	for j := range dp {  //@init
		dp[j] = 1 //@init
	}
	for i := 1; i < m; i++ { // dp[0] 是第 0 列，永远是 1，不用改 //@row
		for j := 1; j < n; j++ {
			dp[j] += dp[j-1] // 原来的 dp[j] 是上面，dp[j-1] 是刚算好的左边 //@cell
		}
	}
	return dp[n-1] //@done
}