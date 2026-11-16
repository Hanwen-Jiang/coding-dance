func removeNthFromEnd(head *ListNode, n int) *ListNode {
	dummy := &ListNode{Next: head} //@init
	slow, fast := dummy, dummy     //@init
	for i := 0; i < n; i++ {       // fast 先走 n 步 //@ahead
		fast = fast.Next //@ahead
	}
	for fast.Next != nil { // 一起走，直到 fast 在最后一个节点 //@loop
		slow = slow.Next //@walk
		fast = fast.Next //@walk
	}
	slow.Next = slow.Next.Next // 跳过要删的节点 //@del
	return dummy.Next          //@done
}
