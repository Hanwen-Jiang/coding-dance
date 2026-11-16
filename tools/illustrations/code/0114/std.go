func flatten(root *TreeNode) {
	cur := root //@init
	for cur != nil {
		if cur.Left != nil { //@pre,skip
			pre := cur.Left        //@pre
			for pre.Right != nil { // 左子树最右边的节点 //@pre
				pre = pre.Right //@pre
			}
			pre.Right = cur.Right // 原来的右子树接到它后面 //@move
			cur.Right = cur.Left  // 左子树挪到右边 //@move
			cur.Left = nil        //@move
		}
		cur = cur.Right //@skip
	}
}
