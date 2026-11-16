func canJump(nums []int) bool {
	goal := len(nums) - 1 //@init
	for i := len(nums) - 2; i >= 0; i-- {
		if i+nums[i] >= goal { //@move,stay
			goal = i //@move
		}
	}
	return goal == 0 //@done
}
