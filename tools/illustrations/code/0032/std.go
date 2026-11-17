func longestValidParentheses(s string) int {
	stack, best := []int{-1}, 0 // 栈底：最后一个没匹配上的位置 //@init
	for i := 0; i < len(s); i++ {
		if s[i] == '(' { //@open
			stack = append(stack, i) //@open
		} else { //@lone,match
			stack = stack[:len(stack)-1] //@lone,match
			if len(stack) == 0 { // 这个 ) 没人匹配，成为新的分界线 //@lone,match
				stack = append(stack, i) //@lone
			} else { //@match
				best = max(best, i-stack[len(stack)-1]) //@match
			}
		}
	}
	return best //@done
}
