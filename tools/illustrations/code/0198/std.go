func rob(nums []int) int {
	n := len(nums)         //@init
	dp := make([]int, n+1) // dp[i]：前 i 间房最多偷多少 //@init
	dp[1] = nums[0]        //@init
	for i := 2; i <= n; i++ {
		dp[i] = max(dp[i-1], // 不偷第 i 间 //@step
			dp[i-2]+nums[i-1]) // 偷第 i 间 //@step
	}
	return dp[n] //@done
}
