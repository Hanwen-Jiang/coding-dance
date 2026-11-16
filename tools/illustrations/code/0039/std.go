func combinationSum(candidates []int, target int) [][]int {
	sort.Ints(candidates)           //@init
	res, path := [][]int{}, []int{} //@init
	var dfs func(start, remain int)
	dfs = func(start, remain int) {
		if remain == 0 { //@found
			res = append(res, append([]int{}, path...)) //@found
			return                                      //@found
		}
		for i := start; i < len(candidates); i++ {
			if candidates[i] > remain { // 排过序，后面的只会更大 //@prune
				break //@prune
			}
			path = append(path, candidates[i]) //@pick
			dfs(i, remain-candidates[i])       // 还从 i 开始：可以重复选 //@pick
			path = path[:len(path)-1]
		}
	}
	dfs(0, target) //@init
	return res     //@done
}
