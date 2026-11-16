func trap(height []int) int {
	stack := []int{} // 栈里存下标，高度从底到顶递减 //@init
	water := 0       //@init
	for i, h := range height {
		for len(stack) > 0 && height[stack[len(stack)-1]] < h { //@nowall,fill
			bottom := stack[len(stack)-1] // 坑底 //@nowall,fill
			stack = stack[:len(stack)-1]  //@nowall,fill
			if len(stack) == 0 {          //@nowall
				break // 左边没有墙，接不住 //@nowall
			}
			left := stack[len(stack)-1]                           //@fill
			width := i - left - 1                                 //@fill
			water += (min(height[left], h) - height[bottom]) * width //@fill
		}
		stack = append(stack, i) //@push
	}
	return water //@done
}
