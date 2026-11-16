func lengthOfLongestSubstring(s string) int {
	seen := map[byte]bool{} // 窗口里的字符 //@init
	l, best := 0, 0          //@init
	for r := 0; r < len(s); r++ {
		ch := s[r]
		for seen[ch] { // 有重复，左端收缩 //@shrink
			delete(seen, s[l]) //@shrink
			l++                //@shrink
		}
		seen[ch] = true       //@grow
		best = max(best, r-l+1) //@grow
	}
	return best //@done
}
