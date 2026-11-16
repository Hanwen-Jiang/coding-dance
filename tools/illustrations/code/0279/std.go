func numSquares(n int) int {
	dp := make([]int, n+1) // dp[i]：和为 i 最少几个平方数 //@init
	for i := 1; i <= n; i++ { //@each
		dp[i] = math.MaxInt //@each
		for j := 1; j*j <= i; j++ { //@each
			dp[i] = min(dp[i], dp[i-j*j]+1) // 最后一个数取 j² //@each
		}
	}
	return dp[n] //@done
}
