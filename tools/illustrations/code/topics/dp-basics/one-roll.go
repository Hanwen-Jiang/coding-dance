func minCostClimbingStairs(cost []int) int {
	a, b := 0, 0 // dp[0]、dp[1] //@init
	for i := 2; i <= len(cost); i++ { //@step
		a, b = b, min(b+cost[i-1], a+cost[i-2]) // 新的 b 是 dp[i] //@step
	}
	return b //@done
}
