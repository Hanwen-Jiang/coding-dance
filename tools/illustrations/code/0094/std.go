func inorderTraversal(root *TreeNode) []int {
	res := []int{} //@init
	var dfs func(node *TreeNode)
	dfs = func(node *TreeNode) {
		if node == nil { //@enter
			return
		}
		dfs(node.Left)              // 左 //@enter
		res = append(res, node.Val) // 自己 //@visit
		dfs(node.Right)             // 右 //@visit
	}
	dfs(root)  //@init
	return res //@done
}
