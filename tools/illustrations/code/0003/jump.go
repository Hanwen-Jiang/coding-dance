func lengthOfLongestSubstring(s string) int {
	last := map[byte]int{} //@init
	left, best := 0, 0      //@init
	for i := 0; i < len(s); i++ {
		c := s[i]
		if p, ok := last[c]; ok && p >= left { // c 在窗口里出现过 //@jump,grow
			left = p + 1 //@jump
		}
		last[c] = i                 //@jump,grow
		best = max(best, i-left+1) //@jump,grow
	}
	return best //@done
}
