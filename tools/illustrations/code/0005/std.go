func longestPalindrome(s string) string {
	expand := func(l, r int) [2]int {
		for l >= 0 && r < len(s) && s[l] == s[r] { //@grow,miss
			l-- //@grow
			r++ //@grow
		}
		return [2]int{l + 1, r - 1} // 退回最后一次成功的位置 //@grow
	}
	start, end := 0, 0 //@init
	for i := range s {
		for _, p := range [][2]int{expand(i, i), expand(i, i+1)} { // 奇数中心、偶数中心 //@grow,miss
			if p[1]-p[0] > end-start { //@grow,update
				start, end = p[0], p[1] //@update
			}
		}
	}
	return s[start : end+1] //@done
}
