func longestPalindrome(s string) string {
	n := len(s)             //@init
	dp := make([][]bool, n) // dp[l][r]：s[l..r] 是不是回文 //@init
	for i := range dp {     //@init
		dp[i] = make([]bool, n) //@init
	}
	start, size := 0, 1                      //@init
	for length := 1; length <= n; length++ { // 按长度从短到长填表
		for l := 0; l+length-1 < n; l++ {
			r := l + length - 1                                //@fill
			if s[l] == s[r] && (length <= 2 || dp[l+1][r-1]) { //@fill
				dp[l][r] = true    //@fill
				if length > size { //@fill,update
					start, size = l, length //@update
				}
			}
		}
	}
	return s[start : start+size] //@done
}
