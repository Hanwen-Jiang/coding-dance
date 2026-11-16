func maxArea(height []int) int {
	l, r := 0, len(height)-1 //@init
	best := 0                //@init
	for l < r {
		best = max(best, min(height[l], height[r])*(r-l)) //@area
		if height[l] < height[r] { // 移动短板 //@move
			l++ //@move
		} else { //@move
			r-- //@move
		}
	}
	return best //@done
}
