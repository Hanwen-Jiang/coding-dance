func getIntersectionNode(headA, headB *ListNode) *ListNode {
	pa, pb := headA, headB //@init
	for pa != pb { //@step
		if pa != nil { // 走到空就换到 B 的头 //@step
			pa = pa.Next //@step
		} else {
			pa = headB //@step
		}
		if pb != nil { //@step
			pb = pb.Next //@step
		} else {
			pb = headA //@step
		}
	}
	return pa // 交点，或者都是空 //@done
}
