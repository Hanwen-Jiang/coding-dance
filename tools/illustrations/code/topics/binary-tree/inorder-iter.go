func inorderTraversal(root *TreeNode) []int {
	res, stack, cur := []int{}, []*TreeNode{}, root //@init
	for cur != nil || len(stack) > 0 { //@loop
		for cur != nil { // 一路往左走，沿途的节点压栈 //@push
			stack = append(stack, cur) //@push
			cur = cur.Left             //@push
		}
		cur = stack[len(stack)-1]    // 左边到头了，弹出来访问 //@pop
		stack = stack[:len(stack)-1] //@pop
		res = append(res, cur.Val)   //@pop
		cur = cur.Right // 再去它的右子树 //@right
	}
	return res //@done
}
