func search(nums []int, target int) int {
	lo, hi := 0, len(nums)-1 // 闭区间 [lo, hi] 是还没排除的范围 //@init
	for lo <= hi {           // 区间不空就继续 //@loop
		mid := lo + (hi-lo)/2 //@mid
		if nums[mid] == target { //@hit
			return mid //@hit
		}
		if nums[mid] < target { //@right
			lo = mid + 1 // mid 和它左边都太小 //@right
		} else { //@left
			hi = mid - 1 // mid 和它右边都太大 //@left
		}
	}
	return -1 //@miss
}
