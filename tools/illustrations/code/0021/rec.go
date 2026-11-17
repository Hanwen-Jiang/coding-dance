func mergeTwoLists(list1 *ListNode, list2 *ListNode) *ListNode {
	if list1 == nil { //@base
		return list2 //@base
	}
	if list2 == nil { //@base
		return list1 //@base
	}
	if list1.Val > list2.Val { // 让 list1 指向较小的头 //@pick
		list1, list2 = list2, list1 //@pick
	}
	list1.Next = mergeTwoLists(list1.Next, list2) //@pick,back
	return list1                                  //@back
}
