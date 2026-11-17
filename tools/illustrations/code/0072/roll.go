func minDistance(word1 string, word2 string) int {
	m, n := len(word1), len(word2)
	dp := make([]int, n+1)
	for j := range dp { // 第 0 行：空串变成 word2[:j] 要插入 j 次 //@init
		dp[j] = j //@init
	}
	for i := 1; i <= m; i++ {
		leftup := dp[0] // 先存下左上角 //@row
		dp[0] = i       // 第 0 列是 i（删光） //@row
		for j := 1; j <= n; j++ {
			up := dp[j] // 还没更新，是上一行的值 //@same,diff
			if word1[i-1] == word2[j-1] { //@same,diff
				dp[j] = leftup // 最后一个字符相同，不用动 //@same
			} else {
				dp[j] = 1 + min(up, dp[j-1], leftup) // 删除、插入、替换 //@diff
			}
			leftup = up // 下一格的左上角，就是这一格的上面 //@same,diff
		}
	}
	return dp[n] //@done
}
