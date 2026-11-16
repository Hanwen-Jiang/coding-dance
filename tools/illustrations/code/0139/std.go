func wordBreak(s string, wordDict []string) bool {
	words := map[string]bool{} //@init
	for _, w := range wordDict { //@init
		words[w] = true //@init
	}
	n := len(s)              //@init
	dp := make([]bool, n+1)  // dp[i]：前 i 个字符能不能拆 //@init
	dp[0] = true             //@init
	for i := 1; i <= n; i++ { //@try
		for j := 0; j < i; j++ { //@try
			if dp[j] && words[s[j:i]] { // 前 j 个能拆，s[j:i] 又是一个词 //@try
				dp[i] = true //@hit
				break        //@hit
			}
		}
	}
	return dp[n] //@done
}
