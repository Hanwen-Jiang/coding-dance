func searchInsert(nums []int, target int) int {
	lo, hi := 0, len(nums) // 左闭右开 [lo, hi) //@init
	for lo < hi { //@small,big
		mid := (lo + hi) / 2 //@small,big
		if nums[mid] < target { //@small
			lo = mid + 1 // mid 及左边都太小 //@small
		} else { //@big
			hi = mid // mid 可能就是答案 //@big
		}
	}
	return lo //@done
}
