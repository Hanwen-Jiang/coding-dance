func rightSideView(root *TreeNode) []int {
	res := []int{} //@init
	var dfs func(node *TreeNode, depth int)
	dfs = func(node *TreeNode, depth int) {
		if node == nil {
			return
		}
		if depth == len(res) { // 这一层第一次到 //@first,pass
			res = append(res, node.Val) //@first
		}
		dfs(node.Right, depth+1) // 先右
		dfs(node.Left, depth+1)  // 后左
	}
	dfs(root, 0) //@init
	return res   //@done
}
