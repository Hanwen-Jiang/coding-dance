func combinationSum(candidates []int, target int) [][]int {
	// 从下标 i 往后选，凑出 remain 的所有组合
	var dfs func(i, remain int) [][]int
	dfs = func(i, remain int) [][]int {
		if remain == 0 { //@found
			return [][]int{{}} //@found
		}
		if i == len(candidates) || remain < 0 { //@empty
			return [][]int{} //@empty
		}
		c := candidates[i] //@take
		res := [][]int{}
		for _, rest := range dfs(i, remain-c) { // 再选一次 c //@take
			res = append(res, append([]int{c}, rest...)) //@take
		}
		return append(res, dfs(i+1, remain)...) // 以后都不选 c //@skip
	}
	return dfs(0, target) //@start
}
