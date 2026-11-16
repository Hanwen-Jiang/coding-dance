func sortedArrayToBST(nums []int) *TreeNode {
	var build func(lo, hi int) *TreeNode
	build = func(lo, hi int) *TreeNode {
		if lo > hi {
			return nil
		}
		mid := (lo + hi) / 2              //@node
		node := &TreeNode{Val: nums[mid]} //@node
		node.Left = build(lo, mid-1)      //@sub
		node.Right = build(mid+1, hi)     //@sub
		return node
	}
	return build(0, len(nums)-1) //@init,done
}
