func levelOrder(root *TreeNode) [][]int {
	res := [][]int{}
	if root == nil {
		return res
	}
	q := []*TreeNode{root} //@init
	for len(q) > 0 {
		level := []int{}         //@level
		n := len(q)              // 这一层有 n 个节点 //@level
		for i := 0; i < n; i++ { //@level
			node := q[0]                    //@pop
			q = q[1:]                       //@pop
			level = append(level, node.Val) //@pop
			if node.Left != nil {           //@push
				q = append(q, node.Left) //@push
			}
			if node.Right != nil { //@push
				q = append(q, node.Right) //@push
			}
		}
		res = append(res, level) //@end
	}
	return res //@done
}
