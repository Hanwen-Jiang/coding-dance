func maxPathSum(root *TreeNode) int {
	best := math.MinInt //@init
	// 从 node 往下一条链的最大和
	var gain func(node *TreeNode) int
	gain = func(node *TreeNode) int {
		if node == nil {
			return 0
		}
		l := max(gain(node.Left), 0)      // 负的就不要了 //@node
		r := max(gain(node.Right), 0)     //@node
		best = max(best, node.Val+l+r)    // 以 node 为最高点的路径 //@node
		return node.Val + max(l, r)       // 往上只能带一条链 //@node
	}
	gain(root)  //@init
	return best //@done
}
