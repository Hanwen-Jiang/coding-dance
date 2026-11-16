func canJump(nums []int) bool {
	far := 0 // 目前能到的最远下标 //@init
	for i, x := range nums {
		if i > far { // 连 i 都到不了 //@bad
			return false //@bad
		}
		far = max(far, i+x)       //@grow
		if far >= len(nums)-1 {   //@grow,reach
			return true           //@reach
		}
	}
	return true
}
