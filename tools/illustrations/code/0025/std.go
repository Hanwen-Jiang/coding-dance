func reverseKGroup(head *ListNode, k int) *ListNode {
	dummy := &ListNode{Next: head} //@dummy
	groupPrev := dummy             //@gp0
	for {
		kth := groupPrev           //@kth0
		for i := 0; i < k; i++ {   // 往前数 k 个
			kth = kth.Next         //@kstep
			if kth == nil {        //@kchk
				return dummy.Next  // 不够 k 个，剩下的不动 //@ret
			}
		}
		groupNext := kth.Next    // 下一组的开头 //@cut
		prev := groupNext        // prev 从 groupNext 开始 //@prev0
		cur := groupPrev.Next    //@cur0
		for cur != groupNext {   // 组内反转 //@exit
			nxt := cur.Next      // 先记住下一个 //@save
			cur.Next = prev      // 箭头掉头 //@flip
			prev = cur           //@mprev
			cur = nxt            //@mcur
		}
		first := groupPrev.Next // 这组原来的头，现在是尾 //@first
		groupPrev.Next = kth    // 前面接上新的头 //@link
		groupPrev = first       //@next
	}
}
