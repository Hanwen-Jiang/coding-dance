func maxDepth(root *TreeNode) int {
	if root == nil { //@base
		return 0 //@base
	}
	return max(maxDepth(root.Left), maxDepth(root.Right)) + 1 //@down,depth
}
