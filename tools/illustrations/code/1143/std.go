func longestCommonSubsequence(text1 string, text2 string) int {
	m, n := len(text1), len(text2) //@init
	dp := make([][]int, m+1)       //@init
	for i := range dp {            //@init
		dp[i] = make([]int, n+1) //@init
	}
	for i := 1; i <= m; i++ {
		for j := 1; j <= n; j++ {
			if text1[i-1] == text2[j-1] { //@same,diff
				dp[i][j] = dp[i-1][j-1] + 1 // 一起算进去 //@same
			} else { //@diff
				dp[i][j] = max(dp[i-1][j], dp[i][j-1]) // 扔掉一边的最后一个 //@diff
			}
		}
	}
	return dp[m][n] //@done
}
