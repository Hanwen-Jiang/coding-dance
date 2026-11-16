func threeSum(nums []int) [][]int {
	sort.Ints(nums)              //@sort
	res := map[[3]int]bool{}     //@sort
	for i, x := range nums {
		if i > 0 && x == nums[i-1] { //@skip
			continue //@skip
		}
		seen := map[int]bool{} //@fix
		for _, y := range nums[i+1:] {
			if seen[-x-y] { //@found,miss
				res[[3]int{x, -x - y, y}] = true //@found
			}
			seen[y] = true //@miss
		}
	}
	out := [][]int{}          //@done
	for t := range res {      //@done
		out = append(out, []int{t[0], t[1], t[2]}) //@done
	}
	sort.Slice(out, func(a, b int) bool { //@done
		for k := 0; k < 3; k++ {
			if out[a][k] != out[b][k] {
				return out[a][k] < out[b][k]
			}
		}
		return false
	})
	return out //@done
}
