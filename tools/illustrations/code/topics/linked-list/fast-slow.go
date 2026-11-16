func middleNode(head *ListNode) *ListNode {
	slow, fast := head, head //@init
	for fast != nil && fast.Next != nil { // fast 还能再走两步 //@loop
		slow = slow.Next      // 慢指针走一步 //@step
		fast = fast.Next.Next // 快指针走两步 //@step
	}
	return slow // fast 到头时 slow 在中间 //@done
}
