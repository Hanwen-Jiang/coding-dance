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
		groupNext := kth.Next                  // 下一组的开头 //@cut
		prev, cur := groupNext, groupPrev.Next // prev 从 groupNext 开始 //@setup
		for cur != groupNext {                 // 组内反转 //@flip
			nxt := cur.Next                    // 先记住下一个 //@flip
			cur.Next = prev                    // 箭头掉头 //@flip
			prev, cur = cur, nxt               //@move
		}
		first := groupPrev.Next // 这组原来的头，现在是尾 //@link
		groupPrev.Next = kth    // 前面接上新的头 //@link
		groupPrev = first       //@next
	}
}
