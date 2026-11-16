func flatten(root *TreeNode) {
	var prev *TreeNode //@init
	// 按 右 → 左 → 根 的顺序访问，从链表的尾巴往头接
	var dfs func(node *TreeNode)
	dfs = func(node *TreeNode) {
		if node == nil {
			return
		}
		dfs(node.Right)
		dfs(node.Left)
		node.Right, node.Left, prev = prev, nil, node //@link
	}
	dfs(root) //@init
}
