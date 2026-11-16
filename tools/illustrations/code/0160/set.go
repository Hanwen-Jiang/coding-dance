func getIntersectionNode(headA, headB *ListNode) *ListNode {
	seen := map[*ListNode]bool{} //@init
	for headA != nil { //@addA
		seen[headA] = true  //@addA
		headA = headA.Next  //@addA
	}
	for headB != nil && !seen[headB] { //@walkB,found,none
		headB = headB.Next //@walkB
	}
	return headB //@found,none
}
