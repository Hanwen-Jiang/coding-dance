func moveZeroes(nums []int) {
	j := 0                         // 下一个非零数放的位置 //@init
	for i := 0; i < len(nums); i++ { //@scan
		if nums[i] != 0 { //@swap
			nums[i], nums[j] = nums[j], nums[i] //@swap
			j++                                 //@swap
		}
	}
}
