func maxSubArray(nums []int) int {
	cur, best := nums[0], nums[0] //@init
	for _, x := range nums[1:] {
		cur = max(x, cur+x)   // 接上前面，或者重新开始 //@step
		best = max(best, cur) //@step
	}
	return best //@done
}
