func rob(nums []int) int {
	prev, cur := 0, 0 // dp[-1]（越界）和 dp[0]（没有房子），都是 0 //@init
	for _, x := range nums { //@step
		prev, cur = cur, max(cur, prev+x) // 不偷：cur；偷：prev + x //@step
	}
	return cur //@done
}
