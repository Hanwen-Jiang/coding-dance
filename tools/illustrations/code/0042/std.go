func trap(height []int) int {
	l, r := 0, len(height)-1 //@init
	leftMax, rightMax := 0, 0 //@init
	water := 0                //@init
	for l < r {
		leftMax = max(leftMax, height[l])   //@left,right
		rightMax = max(rightMax, height[r]) //@left,right
		if leftMax < rightMax { // 左边矮，l 这一格水位就是 leftMax //@left
			water += leftMax - height[l] //@left
			l++                          //@left
		} else { //@right
			water += rightMax - height[r] //@right
			r--                           //@right
		}
	}
	return water //@done
}
