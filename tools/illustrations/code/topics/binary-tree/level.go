func largestValues(root *TreeNode) []int {
	res := []int{}
	q := []*TreeNode{} //@init
	if root != nil {   //@init
		q = append(q, root) //@init
	}
	for len(q) > 0 {
		best := q[0].Val //@level
		for n := len(q); n > 0; n-- { // 这一层有 len(q) 个节点 //@level
			node := q[0] //@pop
			q = q[1:]    //@pop
			if node.Val > best { //@pop
				best = node.Val //@pop
			}
			if node.Left != nil { //@push
				q = append(q, node.Left) //@push
			}
			if node.Right != nil { //@push
				q = append(q, node.Right) //@push
			}
		}
		res = append(res, best) //@end
	}
	return res //@done
}
