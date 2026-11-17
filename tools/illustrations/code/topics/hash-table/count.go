func firstUniqChar(s string) int {
	cnt := map[byte]int{} // 字符 -> 出现次数，没见过的默认是 0 //@init
	for i := 0; i < len(s); i++ { //@count
		cnt[s[i]]++ //@count
	}
	for i := 0; i < len(s); i++ { // 再按原来的顺序找 //@find
		if cnt[s[i]] == 1 { //@find
			return i //@hit
		}
	}
	return -1 //@miss
}
