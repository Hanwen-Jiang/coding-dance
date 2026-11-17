func inorderTraversal(root *TreeNode) []int {
	res, stack, cur := []int{}, []*TreeNode{}, root //@init
	for cur != nil || len(stack) > 0 {
		for cur != nil { // 一路向左，沿途入栈 //@left
			stack = append(stack, cur) //@left
			cur = cur.Left             //@left
		}
		cur = stack[len(stack)-1]    //@pop
		stack = stack[:len(stack)-1] //@pop
		res = append(res, cur.Val)   //@pop
		cur = cur.Right              // 转向右子树 //@pop
	}
	return res //@done
}
