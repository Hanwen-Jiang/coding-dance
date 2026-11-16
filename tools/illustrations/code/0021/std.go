func mergeTwoLists(list1 *ListNode, list2 *ListNode) *ListNode {
	dummy := &ListNode{} //@init
	cur := dummy         //@init
	for list1 != nil && list2 != nil {
		if list1.Val <= list2.Val { //@take1,take2
			cur.Next = list1   //@take1
			list1 = list1.Next //@take1
		} else { //@take2
			cur.Next = list2   //@take2
			list2 = list2.Next //@take2
		}
		cur = cur.Next //@take1,take2
	}
	if list1 != nil { // 剩下的整段接上 //@rest
		cur.Next = list1 //@rest
	} else { //@rest
		cur.Next = list2 //@rest
	}
	return dummy.Next //@done
}
