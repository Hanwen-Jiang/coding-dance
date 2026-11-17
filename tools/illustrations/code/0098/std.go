func isValidBST(root *TreeNode) bool {
	// node 的值必须在开区间 (lo, hi) 里
	var check func(node *TreeNode, lo, hi int) bool
	check = func(node *TreeNode, lo, hi int) bool {
		if node == nil {
			return true
		}
		if node.Val <= lo || node.Val >= hi { //@range
			return false //@bad
		}
		return check(node.Left, lo, node.Val) && check(node.Right, node.Val, hi) //@down
	}
	return check(root, math.MinInt64, math.MaxInt64) //@start
}
