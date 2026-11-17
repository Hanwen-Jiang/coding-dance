func pathSum(root *TreeNode, targetSum int) int {
	cnt := map[int]int{0: 1} // 空前缀：路径从根开始 //@init
	var dfs func(node *TreeNode, cur int) int
	dfs = func(node *TreeNode, cur int) int {
		if node == nil {
			return 0
		}
		cur += node.Val           // 根到 node 的前缀和 //@visit
		res := cnt[cur-targetSum] // 前面有几个前缀和差正好是 targetSum //@visit
		cnt[cur]++
		res += dfs(node.Left, cur) + dfs(node.Right, cur)
		cnt[cur]-- // 回溯：离开这条路径
		return res
	}
	return dfs(root, 0) //@init,done
}
