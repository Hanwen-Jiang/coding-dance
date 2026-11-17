func largestRectangleArea(heights []int) int {
	h := append(append([]int{0}, heights...), 0) // 两头加哨兵 //@init
	stack, best := []int{}, 0                    // 栈里下标对应的高度递增 //@init
	for i := range h {
		for len(stack) > 0 && h[stack[len(stack)-1]] > h[i] { //@pop
			top := stack[len(stack)-1] // 以它为高的矩形，右边界是 i //@pop
			stack = stack[:len(stack)-1] //@pop
			left := stack[len(stack)-1] // 左边界是新的栈顶 //@pop
			best = max(best, h[top]*(i-left-1)) //@pop
		}
		stack = append(stack, i) //@push
	}
	return best //@done
}
