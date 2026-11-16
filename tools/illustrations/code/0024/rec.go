func swapPairs(head *ListNode) *ListNode {
	if head == nil || head.Next == nil { //@base
		return head //@base
	}
	nxt := head.Next                //@call
	head.Next = swapPairs(nxt.Next) //@call,swap
	nxt.Next = head                 //@swap
	return nxt                      //@swap,done
}
