func swapPairs(head *ListNode) *ListNode {
	dummy := &ListNode{Next: head}                  //@init
	prev := dummy                                   //@init
	for prev.Next != nil && prev.Next.Next != nil { //@pair
		a, b := prev.Next, prev.Next.Next        //@pair
		prev.Next, a.Next, b.Next = b, b.Next, a // 三根指针一起改 //@swap
		prev = a                                 // a 现在在后面，是下一对的前驱 //@next
	}
	return dummy.Next //@done
}
