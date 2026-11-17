func isSymmetric(root *TreeNode) bool {
	// a 和 b 两棵子树是否互为镜像
	var check func(a, b *TreeNode) bool
	check = func(a, b *TreeNode) bool {
		if a == nil && b == nil { //@both
			return true //@both
		}
		if a == nil || b == nil || a.Val != b.Val { //@diff
			return false //@diff
		}
		return check(a.Left, b.Right) && check(a.Right, b.Left) //@same
	}
	return check(root.Left, root.Right) //@start
}
