func reverseList(head *ListNode) *ListNode {
	var prev *ListNode //@init
	cur := head        //@init
	for cur != nil {
		nxt := cur.Next      // 先记住下一个 //@flip
		cur.Next = prev      // 箭头掉头 //@flip
		prev, cur = cur, nxt // 两个指针都往前走 //@move
	}
	return prev //@done
}
