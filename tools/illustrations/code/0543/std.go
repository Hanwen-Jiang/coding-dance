func diameterOfBinaryTree(root *TreeNode) int {
	best := 0 //@init
	var depth func(node *TreeNode) int
	depth = func(node *TreeNode) int {
		if node == nil {
			return 0
		}
		l, r := depth(node.Left), depth(node.Right) //@calc
		best = max(best, l+r)                       // 在这个节点拐弯的最长路径 //@calc
		return max(l, r) + 1                        // 返回给上一层的是深度 //@calc
	}
	depth(root) //@init
	return best //@done
}
