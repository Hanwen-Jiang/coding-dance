func reverseList(head *ListNode) *ListNode {
	var prev *ListNode //@init
	cur := head        //@init
	for cur != nil {
		nxt := cur.Next // 先记住下一个 //@save
		cur.Next = prev // 箭头掉头 //@flip
		prev = cur      //@mprev
		cur = nxt       //@mcur
	}
	return prev //@done
}
