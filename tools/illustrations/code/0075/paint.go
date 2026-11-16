func sortColors(nums []int) {
	p0, p1 := 0, 0 // 下一个 0、下一个 1 该写的位置 //@init
	for i, x := range nums { //@read
		nums[i] = 2 //@read
		if x < 2 {  //@one
			nums[p1] = 1 //@one
			p1++         //@one
		}
		if x == 0 { //@zero
			nums[p0] = 0 //@zero
			p0++         //@zero
		}
	}
}
