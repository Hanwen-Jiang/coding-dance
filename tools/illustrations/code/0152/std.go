func maxProduct(nums []int) int {
	hi, lo, best := nums[0], nums[0], nums[0] // 以当前位置结尾的最大积、最小积 //@init
	for _, x := range nums[1:] {
		if x < 0 { //@swap
			hi, lo = lo, hi // 乘负数，大小互换 //@swap
		}
		hi = max(x, hi*x)    //@update
		lo = min(x, lo*x)    //@update
		best = max(best, hi) //@update
	}
	return best //@done
}
