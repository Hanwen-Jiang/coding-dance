func permute(nums []int) [][]int {
	res, path, used := [][]int{}, []int{}, make([]bool, len(nums)) //@init
	var dfs func()
	dfs = func() {
		if len(path) == len(nums) { //@collect
			res = append(res, append([]int(nil), path...)) //@collect
			return                                         //@collect
		}
		for i, x := range nums {
			if used[i] {
				continue
			}
			used[i] = true         //@choose
			path = append(path, x) //@choose
			dfs()
			path = path[:len(path)-1] // 撤销选择
			used[i] = false
		}
	}
	dfs()      //@init
	return res //@done
}
