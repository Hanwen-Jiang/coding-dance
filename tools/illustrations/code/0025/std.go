func reverseKGroup(head *ListNode, k int) *ListNode {
	dummy := &ListNode{Next: head} //@init
	groupPrev := dummy             //@init
	for {                          //@count
		kth := groupPrev           //@count
		for i := 0; i < k; i++ {   // 往前数 k 个 //@count
			kth = kth.Next         //@count
			if kth == nil {        //@count
				return dummy.Next  // 不够 k 个，剩下的不动 //@done
			}
		}
		groupNext := kth.Next                    //@rev
		prev, cur := groupNext, groupPrev.Next   //@rev
		for cur != groupNext {                   // 组内反转 //@rev
			cur.Next, prev, cur = prev, cur, cur.Next //@rev
		}
		first := groupPrev.Next // 这组原来的头，现在是尾 //@rev
		groupPrev.Next = kth    // 前面接上新的头 //@rev
		groupPrev = first       //@next
	}
}
