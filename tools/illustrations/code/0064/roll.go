func minPathSum(grid [][]int) int {
	n := len(grid[0])
	dp := make([]int, n)
	for j := range dp { // 第 -1 行：越界，走不过来，全是 ∞ //@init
		dp[j] = math.MaxInt //@init
	}
	dp[0] = 0 // 只有起点的「上面」当成 0 //@init
	for _, row := range grid { //@row
		for j := 0; j < n; j++ {
			left := math.MaxInt // j = 0 时左边越界，取 ∞ //@cell
			if j > 0 {          //@cell
				left = dp[j-1] //@cell
			}
			dp[j] = min(dp[j], left) + row[j] // 上面是 dp[j]，左边是 dp[j-1] //@cell
		}
	}
	return dp[n-1] //@done
}