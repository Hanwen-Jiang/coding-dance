func combine(n int, k int) [][]int {
	res, path := [][]int{}, []int{}
	var dfs func(start int)
	dfs = func(start int) {
		if len(path) == k { // 选够了 //@full
			res = append(res, append([]int{}, path...)) //@full
			return                                      //@full
		}
		need := k - len(path) // 还要选几个 //@choose
		for x := start; x <= n-need+1; x++ { // 剪枝：后面的数要够选 //@choose
			path = append(path, x) //@choose
			dfs(x + 1)             //@choose
			path = path[:len(path)-1] //@undo
		}
	}
	dfs(1)     //@start
	return res //@done
}
