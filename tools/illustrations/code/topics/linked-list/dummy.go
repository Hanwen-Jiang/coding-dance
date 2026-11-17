func removeElements(head *ListNode, val int) *ListNode {
	dummy := &ListNode{Next: head} // 头节点前面也有一个节点了 //@init
	cur := dummy                   //@init
	for cur.Next != nil {          // 检查的是 cur 的下一个节点 //@check
		if cur.Next.Val == val { //@check
			cur.Next = cur.Next.Next // 跳过它，就把它删掉了 //@del
		} else { //@keep
			cur = cur.Next //@keep
		}
	}
	return dummy.Next //@done
}
