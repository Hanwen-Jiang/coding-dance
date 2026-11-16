func isValid(s string) bool {
	pairs := map[byte]byte{')': '(', ']': '[', '}': '{'} //@init
	stack := []byte{}                                    //@init
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if open, ok := pairs[ch]; ok { // 右括号 //@match
			if len(stack) == 0 || stack[len(stack)-1] != open { //@match
				return false //@bad
			}
			stack = stack[:len(stack)-1] //@match
		} else { // 左括号 //@push
			stack = append(stack, ch) //@push
		}
	}
	return len(stack) == 0 //@done
}
