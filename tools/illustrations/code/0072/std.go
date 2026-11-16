func minDistance(word1 string, word2 string) int {
	m, n := len(word1), len(word2) //@init
	dp := make([][]int, m+1)       //@init
	for i := range dp {            //@init
		dp[i] = make([]int, n+1) //@init
		dp[i][0] = i             // 全删掉 //@init
	}
	for j := 0; j <= n; j++ { //@init
		dp[0][j] = j // 全插入 //@init
	}
	for i := 1; i <= m; i++ {
		for j := 1; j <= n; j++ {
			if word1[i-1] == word2[j-1] { //@same,diff
				dp[i][j] = dp[i-1][j-1] // 最后一个字符不用动 //@same
			} else { //@diff
				dp[i][j] = 1 + min(dp[i-1][j], // 删除 //@diff
					dp[i][j-1],   // 插入 //@diff
					dp[i-1][j-1]) // 替换 //@diff
			}
		}
	}
	return dp[m][n] //@done
}
