func pathSum(root *TreeNode, targetSum int) int {
	if root == nil { //@empty
		return 0 //@empty
	}
	return down(root, targetSum) + pathSum(root.Left, targetSum) + pathSum(root.Right, targetSum) //@start,done
}

// 从 node 开始往下、和为 t 的路径数
func down(node *TreeNode, t int) int {
	if node == nil {
		return 0
	}
	res := down(node.Left, t-node.Val) + down(node.Right, t-node.Val) //@down
	if node.Val == t {                                                //@down
		res++ //@down
	}
	return res //@down
}
