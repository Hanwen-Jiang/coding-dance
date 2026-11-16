func sortList(head *ListNode) *ListNode {
	if head == nil || head.Next == nil { //@base
		return head //@base
	}
	slow, fast := head, head.Next // fast 先走一步，slow 停在前半段末尾 //@mid
	for fast != nil && fast.Next != nil { //@mid
		slow, fast = slow.Next, fast.Next.Next //@mid
	}
	mid := slow.Next                          // 从中间断开 //@cut
	slow.Next = nil                           //@cut
	left, right := sortList(head), sortList(mid) //@rec
	dummy := &ListNode{}                      //@merge
	cur := dummy                              //@merge
	for left != nil && right != nil {         // 合并两个有序链表 //@merge
		if left.Val <= right.Val { //@merge
			cur.Next, left = left, left.Next //@merge
		} else {
			cur.Next, right = right, right.Next //@merge
		}
		cur = cur.Next //@merge
	}
	if left != nil { //@merge
		cur.Next = left //@merge
	} else {
		cur.Next = right //@merge
	}
	return dummy.Next //@merge,done
}
