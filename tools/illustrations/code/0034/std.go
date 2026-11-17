func searchRange(nums []int, target int) []int {
	// 第一个 >= x 的下标
	lowerBound := func(x int) int {
		lo, hi := 0, len(nums) // 左闭右开 [lo, hi) //@lb
		for lo < hi {
			mid := (lo + hi) / 2 //@mid
			if nums[mid] < x {   //@right
				lo = mid + 1 //@right
			} else {
				hi = mid //@left
			}
		}
		return lo //@lbret
	}
	start := lowerBound(target)                     //@start
	if start == len(nums) || nums[start] != target { //@none
		return []int{-1, -1} //@none
	}
	return []int{start, lowerBound(target+1) - 1} //@end
}
