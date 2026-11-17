func traversals(root *TreeNode) [][]int {
	pre, ino, post := []int{}, []int{}, []int{}
	var dfs func(node *TreeNode)
	dfs = func(node *TreeNode) {
		if node == nil { //@base
			return //@base
		}
		pre = append(pre, node.Val)   // 前序：刚进入这个节点 //@pre
		dfs(node.Left)                //@left
		ino = append(ino, node.Val)   // 中序：左子树走完了 //@in
		dfs(node.Right)               //@right
		post = append(post, node.Val) // 后序：两棵子树都走完了 //@post
	}
	dfs(root)                        //@start
	return [][]int{pre, ino, post}   //@done
}
