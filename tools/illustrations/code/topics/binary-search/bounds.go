func countTarget(scores []int, target int) int {
	// 第一个 >= x 的位置，没有就是 len(scores)
	lowerBound := func(x int) int {
		lo, hi := 0, len(scores) // 左闭右开 [lo, hi) //@init
		for lo < hi {            //@loop
			mid := lo + (hi-lo)/2 //@mid
			if scores[mid] < x { //@right
				lo = mid + 1 // mid 太小，一定不是答案 //@right
			} else { //@left
				hi = mid // mid 可能就是答案，留在区间里 //@left
			}
		}
		return lo //@ret
	}
	left := lowerBound(target)       // target 第一次出现的位置 //@first
	right := lowerBound(target + 1) // 第一个比 target 大的位置 //@second
	return right - left             //@done
}
