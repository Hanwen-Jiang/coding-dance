func flatten(root *TreeNode) {
	cur := root //@init
	for cur != nil {
		if cur.Left != nil { //@check
			pre := cur.Left        //@pre0
			for pre.Right != nil { // 左子树最右边的节点
				pre = pre.Right //@prestep
			}
			pre.Right = cur.Right // 原来的右子树接到它后面 //@hook
			cur.Right = cur.Left  // 左子树挪到右边 //@move
			cur.Left = nil        // 断开左指针 //@clear
		}
		cur = cur.Right //@next
	}
}
