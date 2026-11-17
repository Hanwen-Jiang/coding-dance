func subsets(nums []int) [][]int {
	res, path := [][]int{}, []int{}
	// 接下来只能从 nums[i:] 里选
	var dfs func(i int)
	dfs = func(i int) {
		res = append(res, append([]int{}, path...)) // 树上每个节点都是一个子集（复制一份） //@record
		for j := i; j < len(nums); j++ { //@choose
			path = append(path, nums[j]) // 选 nums[j] //@choose
			dfs(j + 1)                   // 下一个只能从 j+1 开始选，不会重复 //@choose
			path = path[:len(path)-1]    // 撤销，换下一个 //@undo
		}
	}
	dfs(0)     //@start
	return res //@done
}
