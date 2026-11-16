func invertTree(root *TreeNode) *TreeNode {
	if root == nil { //@base
		return nil //@base
	}
	root.Left, root.Right = root.Right, root.Left // 交换左右孩子 //@swap
	invertTree(root.Left)                         //@rec
	invertTree(root.Right)                        //@rec
	return root                                   //@done
}
