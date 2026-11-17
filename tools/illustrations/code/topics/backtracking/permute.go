func permute(nums []int) [][]int {
	res, path, used := [][]int{}, []int{}, make([]bool, len(nums))
	var dfs func()
	dfs = func() {
		if len(path) == len(nums) { // 放满了：一个排列 //@full
			res = append(res, append([]int{}, path...)) //@full
			return                                      //@full
		}
		for j := range nums { // 每个位置可以放任何一个还没用过的数 //@choose
			if used[j] { //@choose
				continue //@choose
			}
			used[j] = true               //@choose
			path = append(path, nums[j]) //@choose
			dfs()                        //@choose
			path = path[:len(path)-1] // 撤销 //@undo
			used[j] = false           //@undo
		}
	}
	dfs()      //@start
	return res //@done
}
