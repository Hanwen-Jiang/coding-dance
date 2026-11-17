func removeNthFromEnd(head *ListNode, n int) *ListNode {
	// 返回 node 是倒数第几个
	var rec func(node *ListNode) int
	rec = func(node *ListNode) int {
		if node == nil { //@base
			return 0 //@base
		}
		k := rec(node.Next) + 1 //@down,count
		if k == n+1 {           //@del
			node.Next = node.Next.Next //@del
		}
		return k //@ret
	}
	dummy := &ListNode{Next: head} //@start
	rec(dummy)                     //@start
	return dummy.Next              //@done
}
