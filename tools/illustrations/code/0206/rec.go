func reverseList(head *ListNode) *ListNode {
	if head == nil || head.Next == nil { //@base
		return head //@base
	}
	newHead := reverseList(head.Next) //@down
	head.Next.Next = head             // 让后一个节点指回自己 //@back
	head.Next = nil                   //@cut
	return newHead                    //@ret
}
