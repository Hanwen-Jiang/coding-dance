func longestCommonSubsequence(text1 string, text2 string) int {
	n := len(text2)
	prev := make([]int, n+1) // 第 0 行：text1 取空串，全是 0 //@init
	for i := 0; i < len(text1); i++ { //@row
		cur := make([]int, n+1) // 这一行的第 0 列：text2 取空串，是 0 //@row
		for j := 0; j < n; j++ {
			if text1[i] == text2[j] { // 左上 prev[j]，上面 prev[j+1]，左边 cur[j] //@same,diff
				cur[j+1] = prev[j] + 1 //@same,diff
			} else {
				cur[j+1] = max(prev[j+1], cur[j]) //@same,diff
			}
		}
		prev = cur // 这一行算完，成了下一行的「上一行」 //@next
	}
	return prev[n] //@done
}