func longestConsecutive(nums []int) int {
	lens := map[int]int{} //@init
	best := 0             //@init
	for _, x := range nums {
		if _, ok := lens[x]; !ok { //@dup
			l, r := lens[x-1], lens[x+1] //@join
			n := l + r + 1               //@join
			lens[x] = n                  //@join
			lens[x-l] = n                // 只更新新段的两个端点 //@join
			lens[x+r] = n                //@join
			best = max(best, n)          //@join
		}
	}
	return best //@done
}
