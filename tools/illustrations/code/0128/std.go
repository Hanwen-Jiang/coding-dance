func longestConsecutive(nums []int) int {
	s := map[int]bool{} //@init
	for _, x := range nums {
		s[x] = true //@init
	}
	best := 0       //@init
	for x := range s { // 遍历集合，不是遍历 nums
		if s[x-1] { //@skip
			continue // 不是起点，跳过 //@skip
		}
		y := x        //@start
		for s[y+1] { //@count
			y++ //@count
		}
		best = max(best, y-x+1) //@best
	}
	return best //@done
}
