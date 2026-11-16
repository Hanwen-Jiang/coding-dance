func decodeString(s string) string {
	type saved struct {
		prev  string
		times int
	}
	stack, cur, k := []saved{}, "", 0 //@init
	for _, c := range s {
		if c >= '0' && c <= '9' { //@digit
			k = k*10 + int(c-'0') // 数字可能不止一位 //@digit
		} else if c == '[' { //@push
			stack = append(stack, saved{cur, k}) // 存档：括号外的前缀和重复次数 //@push
			cur, k = "", 0                       //@push
		} else if c == ']' { //@pop
			top := stack[len(stack)-1]                      //@pop
			stack = stack[:len(stack)-1]                    //@pop
			cur = top.prev + strings.Repeat(cur, top.times) // 展开后接回前缀 //@pop
		} else { //@letter
			cur += string(c) //@letter
		}
	}
	return cur //@done
}
