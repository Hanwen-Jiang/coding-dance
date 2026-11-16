func lowestCommonAncestor(root, p, q *TreeNode) *TreeNode {
	parent := map[*TreeNode]*TreeNode{root: nil} //@init
	stack := []*TreeNode{root}                   //@init
	for !hasKey(parent, p) || !hasKey(parent, q) { //@parent
		node := stack[len(stack)-1] //@parent
		stack = stack[:len(stack)-1] //@parent
		for _, child := range []*TreeNode{node.Left, node.Right} { //@parent
			if child != nil { //@parent
				parent[child] = node          //@parent
				stack = append(stack, child) //@parent
			}
		}
	}
	ancestors := map[*TreeNode]bool{} //@up
	for p != nil { // p 和它所有的祖先 //@up
		ancestors[p] = true //@up
		p = parent[p]       //@up
	}
	for !ancestors[q] { // q 往上走，第一个碰到的就是答案 //@climb
		q = parent[q] //@climb
	}
	return q //@done
}

func hasKey(m map[*TreeNode]*TreeNode, k *TreeNode) bool {
	_, ok := m[k]
	return ok
}
