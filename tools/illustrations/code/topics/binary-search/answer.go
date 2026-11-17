func minEatingSpeed(piles []int, h int) int {
	// 速度为 k 时要吃几小时
	hours := func(k int) int {
		total := 0
		for _, p := range piles {
			total += (p + k - 1) / k //@check
		}
		return total
	}
	lo, hi := 1, slices.Max(piles) // 答案一定在 [lo, hi] 里 //@init
	for lo < hi {                  //@loop
		mid := lo + (hi-lo)/2 //@mid
		if hours(mid) <= h {  // 吃得完：答案是 mid 或更小 //@ok
			hi = mid //@ok
		} else { // 吃不完：要更快 //@slow
			lo = mid + 1 //@slow
		}
	}
	return lo //@done
}
