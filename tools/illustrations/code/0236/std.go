func lowestCommonAncestor(root, p, q *TreeNode) *TreeNode {
	if root == nil || root == p || root == q { //@base
		return root // 空，或者就是要找的节点 //@base
	}
	left := lowestCommonAncestor(root.Left, p, q)   //@rec
	right := lowestCommonAncestor(root.Right, p, q) //@rec
	if left != nil && right != nil { //@both,one
		return root // p、q 分在两边 //@both
	}
	if left != nil { // 哪边有就交哪边 //@one
		return left //@one
	}
	return right //@one
}
