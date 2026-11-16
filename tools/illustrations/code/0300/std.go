func lengthOfLIS(nums []int) int {
	dp := make([]int, len(nums)) // dp[i]：以 nums[i] 结尾的 LIS 长度 //@init
	best := 0
	for i := range nums { //@each
		dp[i] = 1 //@each
		for j := 0; j < i; j++ { //@each
			if nums[j] < nums[i] { //@each
				dp[i] = max(dp[i], dp[j]+1) // 接在 nums[j] 后面 //@each
			}
		}
		best = max(best, dp[i])
	}
	return best //@done
}
