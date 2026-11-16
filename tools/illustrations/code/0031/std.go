func nextPermutation(nums []int) {
	i := len(nums) - 2                     //@init
	for i >= 0 && nums[i] >= nums[i+1] { // 从右往左找第一个下降 //@findi
		i-- //@findi
	}
	if i >= 0 { //@found
		j := len(nums) - 1        //@findj
		for nums[j] <= nums[i] { // 右边第一个比 nums[i] 大的 //@findj
			j-- //@findj
		}
		nums[i], nums[j] = nums[j], nums[i] //@swap
	}
	l, r := i+1, len(nums)-1 // 右段反转成升序 //@rev
	for l < r {              //@rev
		nums[l], nums[r] = nums[r], nums[l] //@rev
		l, r = l+1, r-1                     //@rev
	}
}
