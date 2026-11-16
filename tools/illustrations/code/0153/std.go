func findMin(nums []int) int {
	lo, hi := 0, len(nums)-1 //@init
	for lo < hi { //@front,back
		mid := (lo + hi) / 2 //@front,back
		if nums[mid] > nums[hi] { // mid 在前一段，最小值在右边 //@front
			lo = mid + 1 //@front
		} else { // mid 在后一段，可能就是最小值 //@back
			hi = mid //@back
		}
	}
	return nums[lo] //@done
}
