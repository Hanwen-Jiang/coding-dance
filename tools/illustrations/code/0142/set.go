func detectCycle(head *ListNode) *ListNode {
	seen := map[*ListNode]bool{} //@init
	for head != nil && !seen[head] { //@add,found,none
		seen[head] = true //@add
		head = head.Next  //@add
	}
	return head //@found,none
}
