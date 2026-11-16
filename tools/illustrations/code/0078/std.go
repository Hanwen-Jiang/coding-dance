func subsets(nums []int) [][]int {
	res, path := [][]int{}, []int{} //@init
	var dfs func(start int)
	dfs = func(start int) {
		res = append(res, append([]int{}, path...)) // 每个节点都是一个子集 //@collect
		for i := start; i < len(nums); i++ {
			path = append(path, nums[i]) //@pick
			dfs(i + 1)                   // 下一个只能从后面选 //@pick
			path = path[:len(path)-1]
		}
	}
	dfs(0)     //@init
	return res //@done
}
