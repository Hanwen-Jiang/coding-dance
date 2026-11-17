func knapsack(weights []int, values []int, capacity int) int {
	n := len(weights)
	dp := make([][]int, n+1) // 边界：dp[0][c] = 0，没有物品就没有价值 //@init
	for i := range dp {      //@init
		dp[i] = make([]int, capacity+1) //@init
	}
	for i := 1; i <= n; i++ {
		w, v := weights[i-1], values[i-1]
		for c := 0; c <= capacity; c++ {
			dp[i][c] = dp[i-1][c] // 不选第 i 件 //@skip
			if c >= w {           // 装得下才能选 //@take
				dp[i][c] = max(dp[i][c], dp[i-1][c-w]+v) // 选：让出 w 的容量，价值多 v //@take
			}
		}
	}
	return dp[n][capacity] //@done
}
