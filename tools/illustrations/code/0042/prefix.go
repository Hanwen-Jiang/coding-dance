func trap(height []int) int {
	n := len(height)
	left, right := make([]int, n), make([]int, n)
	for i := 0; i < n; i++ { // 从左往右：到这里为止最高的柱子 //@left
		left[i] = height[i] //@left
		if i > 0 {          //@left
			left[i] = max(left[i], left[i-1]) //@left
		}
	}
	for i := n - 1; i >= 0; i-- { // 从右往左：它右边（含自己）最高的柱子 //@right
		right[i] = height[i] //@right
		if i < n-1 {         //@right
			right[i] = max(right[i], right[i+1]) //@right
		}
	}
	water := 0
	for i := 0; i < n; i++ { //@each
		water += min(left[i], right[i]) - height[i] // 水位是两边最高里较矮的那个 //@each
	}
	return water //@done
}
