func isValidBST(root *TreeNode) bool {
	prev := math.MinInt64 // 比任何节点值都小 //@init
	var inorder func(node *TreeNode) bool
	inorder = func(node *TreeNode) bool {
		if node == nil {
			return true
		}
		if !inorder(node.Left) {
			return false
		}
		if node.Val <= prev { // 必须比前一个大 //@bad
			return false //@bad
		}
		prev = node.Val //@ok
		return inorder(node.Right)
	}
	return inorder(root) //@done
}
