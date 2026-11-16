func minWindow(s string, t string) string {
	need := [128]int{} // 每种字符还差几个 //@init
	for i := 0; i < len(t); i++ { //@init
		need[t[i]]++ //@init
	}
	missing := len(t)        // 一共还差几个 //@init
	l, start := 0, 0         //@init
	size := math.MaxInt      //@init
	for r := 0; r < len(s); r++ { //@grow
		ch := s[r]          //@grow
		if need[ch] > 0 {   //@grow
			missing--       //@grow
		}
		need[ch]--          //@grow
		for missing == 0 {  // 窗口合格，尝试收缩 //@shrink
			if r-l+1 < size { //@shrink
				start, size = l, r-l+1 //@shrink
			}
			need[s[l]]++        //@shrink
			if need[s[l]] > 0 { //@shrink
				missing++       //@broke
			}
			l++ //@shrink
		}
	}
	if size == math.MaxInt { //@done
		return "" //@done
	}
	return s[start : start+size] //@done
}
