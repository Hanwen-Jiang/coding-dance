func rightSideView(root *TreeNode) []int {
	res, q := []int{}, []*TreeNode{} //@init
	if root != nil {                 //@init
		q = append(q, root)          //@init
	}
	for len(q) > 0 { //@level
		res = append(res, q[len(q)-1].Val) // 这一层最右边的节点 //@level
		next := []*TreeNode{}              //@level
		for _, node := range q {           //@level
			if node.Left != nil {          //@level
				next = append(next, node.Left) //@level
			}
			if node.Right != nil { //@level
				next = append(next, node.Right) //@level
			}
		}
		q = next //@level
	}
	return res //@done
}
