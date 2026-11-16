func kthSmallest(root *TreeNode, k int) int {
	stack, cur := []*TreeNode{}, root //@init
	for {
		for cur != nil { // 一路向左 //@left
			stack = append(stack, cur) //@left
			cur = cur.Left             //@left
		}
		cur = stack[len(stack)-1]    //@pop
		stack = stack[:len(stack)-1] //@pop
		k--                          //@pop
		if k == 0 {                  // 中序遍历的第 k 个 //@found
			return cur.Val //@found
		}
		cur = cur.Right //@right
	}
}
