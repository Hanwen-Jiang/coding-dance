func buildTree(preorder []int, inorder []int) *TreeNode {
	idx := map[int]int{}
	for i, v := range inorder {
		idx[v] = i // 值 -> 中序下标 //@init
	}
	// 前序 [pl, pr)，中序 [il, ir)
	var build func(pl, pr, il, ir int) *TreeNode
	build = func(pl, pr, il, ir int) *TreeNode {
		if pl == pr {
			return nil
		}
		root := &TreeNode{Val: preorder[pl]} // 前序第一个是根 //@root
		k := idx[root.Val]                   //@root
		leftSize := k - il                   // 中序里根左边的都是左子树 //@root
		root.Left = build(pl+1, pl+1+leftSize, il, k)  //@sub
		root.Right = build(pl+1+leftSize, pr, k+1, ir) //@sub
		return root
	}
	return build(0, len(preorder), 0, len(inorder)) //@init,done
}
