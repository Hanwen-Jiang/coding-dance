func coinChange(coins []int, amount int) int {
	INF := amount + 1          // 最多用 amount 枚，amount + 1 就相当于凑不出 //@init
	dp := make([]int, amount+1) // dp[i]：凑出 i 最少几枚 //@init
	for i := 1; i <= amount; i++ {
		dp[i] = INF //@init
	}
	for i := 1; i <= amount; i++ {
		for _, c := range coins {
			if c <= i && dp[i-c]+1 < dp[i] { //@try
				dp[i] = dp[i-c] + 1 // 最后一枚用 c //@try
			}
		}
	}
	if dp[amount] == INF { //@done
		return -1 //@done
	}
	return dp[amount] //@done
}
