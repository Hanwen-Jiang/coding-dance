func addTwoNumbers(l1 *ListNode, l2 *ListNode) *ListNode {
	dummy := &ListNode{} //@init
	cur := dummy         //@init
	carry := 0           //@init
	for l1 != nil || l2 != nil || carry != 0 {
		total := carry //@add
		if l1 != nil {
			total += l1.Val //@add
			l1 = l1.Next    //@add
		}
		if l2 != nil {
			total += l2.Val //@add
			l2 = l2.Next    //@add
		}
		carry = total / 10                    //@digit
		cur.Next = &ListNode{Val: total % 10} //@digit
		cur = cur.Next                        //@digit
	}
	return dummy.Next //@done
}
