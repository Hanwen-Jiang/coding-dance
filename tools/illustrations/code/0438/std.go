func findAnagrams(s string, p string) []int {
	m, res := len(p), []int{} //@init
	var need, win [26]int     // 每个字母出现的次数 //@init
	for _, c := range p {     //@init
		need[c-'a']++ //@init
	}
	for r := 0; r < len(s); r++ {
		win[s[r]-'a']++ // 右边进 //@in
		if r >= m {
			win[s[r-m]-'a']-- // 左边出 //@out
		}
		if win == need { // 数组可以直接比较 //@cmp
			res = append(res, r-m+1) //@hit
		}
	}
	return res //@done
}
