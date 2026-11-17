func hasPathSum(root *TreeNode, targetSum int) bool {
	if root == nil { //@base
		return false //@base
	}
	rest := targetSum - root.Val // 往下还要凑多少 //@visit
	if root.Left == nil && root.Right == nil { // 叶子：看是不是正好凑够 //@leaf
		return rest == 0 //@leaf
	}
	return hasPathSum(root.Left, rest) || hasPathSum(root.Right, rest) //@down
}
