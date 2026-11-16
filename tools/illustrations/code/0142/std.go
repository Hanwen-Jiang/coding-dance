func detectCycle(head *ListNode) *ListNode {
	slow, fast := head, head //@init
	for fast != nil && fast.Next != nil { //@step
		slow = slow.Next      //@step
		fast = fast.Next.Next //@step
		if slow == fast {     // 相遇，有环 //@step,meet
			p := head //@meet
			for p != slow { // 两边各走一步，在入口相遇 //@walk,entry
				p = p.Next       //@walk
				slow = slow.Next //@walk
			}
			return p //@entry
		}
	}
	return nil //@none
}
