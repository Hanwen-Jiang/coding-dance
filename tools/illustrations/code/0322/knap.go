func coinChange(coins []int, amount int) int {
	INF := amount + 1          // 最多用 amount 枚，amount + 1 就相当于凑不出 //@init
	dp := make([]int, amount+1) //@init
	for i := 1; i <= amount; i++ {
		dp[i] = INF //@init
	}
	for _, c := range coins { //@coin
		for i := c; i <= amount; i++ { // 正序：同一种硬币可以用很多枚
			dp[i] = min(dp[i], dp[i-c]+1) //@upd
		}
	}
	if dp[amount] == INF { //@done
		return -1 //@done
	}
	return dp[amount] //@done
}
