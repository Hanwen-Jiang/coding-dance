func canPartition(nums []int) bool {
	total := 0               //@init,odd
	for _, x := range nums { //@init,odd
		total += x //@init,odd
	}
	if total%2 != 0 { //@odd
		return false //@odd
	}
	target := total / 2          //@init
	dp := make([]bool, target+1) // dp[j]：能不能凑出和 j //@init
	dp[0] = true                 //@init
	for _, x := range nums {     //@add
		for j := target; j >= x; j-- { // 倒序：每个数只用一次 //@add
			dp[j] = dp[j] || dp[j-x] //@add
		}
	}
	return dp[target] //@done
}
