func hasCycle(head *ListNode) bool {
	slow, fast := head, head //@init
	for fast != nil && fast.Next != nil { //@step
		slow = slow.Next      //@step
		fast = fast.Next.Next //@step
		if slow == fast {     //@step,meet
			return true //@meet
		}
	}
	return false //@none
}
