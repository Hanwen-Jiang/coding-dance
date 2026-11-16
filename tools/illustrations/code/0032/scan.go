func longestValidParentheses(s string) int {
	scan := func(s []byte, opener byte) int {
		best, l, r := 0, 0, 0 //@fwd,back
		for _, c := range s {
			if c == opener { //@count
				l++ //@count
			} else {
				r++ //@count
			}
			if l == r { //@eq
				best = max(best, 2*r) //@eq
			} else if r > l { //@reset
				l, r = 0, 0 //@reset
			}
		}
		return best
	}
	rev := []byte(s)
	slices.Reverse(rev)
	return max(scan([]byte(s), '('), scan(rev, ')')) // 反过来扫描时把 ) 当成开括号 //@fwd,back,done
}
