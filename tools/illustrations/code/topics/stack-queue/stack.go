func evalRPN(tokens []string) int {
	stack := []int{} //@init
	for _, t := range tokens { //@loop
		if len(t) > 1 || (t[0] >= '0' && t[0] <= '9') { // 长度大于 1 的一定是数字，比如 "-11" //@push
			v, _ := strconv.Atoi(t)  //@push
			stack = append(stack, v) // 数字直接压栈 //@push
			continue                 //@push
		}
		b := stack[len(stack)-1] // 先弹出的是右边的数 //@pop
		a := stack[len(stack)-2] //@pop
		stack = stack[:len(stack)-2] //@pop
		switch t { //@calc
		case "+": //@calc
			stack = append(stack, a+b) //@calc
		case "-": //@calc
			stack = append(stack, a-b) //@calc
		case "*": //@calc
			stack = append(stack, a*b) //@calc
		default: //@calc
			stack = append(stack, a/b) // 整数除法本来就向零取整 //@calc
		}
	}
	return stack[0] //@done
}
