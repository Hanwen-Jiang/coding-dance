func maxVowels(s string, k int) int {
	isVowel := func(c byte) int {
		if strings.IndexByte("aeiou", c) >= 0 {
			return 1
		}
		return 0
	}
	cnt := 0
	for i := 0; i < k; i++ { // 第一个窗口 //@init
		cnt += isVowel(s[i]) //@init
	}
	best := cnt //@init
	for i := k; i < len(s); i++ { // 窗口右移一格 //@slide
		cnt += isVowel(s[i]) - isVowel(s[i-k]) // 进来 s[i]，出去 s[i-k] //@slide
		if cnt > best { //@slide
			best = cnt //@slide
		}
	}
	return best //@done
}
