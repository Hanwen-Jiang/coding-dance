func knapsack(weights []int, values []int, capacity int) int {
	dp := make([]int, capacity+1) // 一行：一件物品都没有时全是 0 //@init
	for i, w := range weights {   //@item
		v := values[i] //@item
		for c := capacity; c >= w; c-- { // 倒着更新：dp[c - w] 还是上一行的值 //@cell
			dp[c] = max(dp[c], dp[c-w]+v) //@cell
		}
	}
	return dp[capacity] //@done
}
