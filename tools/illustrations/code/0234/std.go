func isPalindrome(head *ListNode) bool {
	slow, fast := head, head              //@init
	for fast != nil && fast.Next != nil { // 找中点 //@mid
		slow = slow.Next      //@mid
		fast = fast.Next.Next //@mid
	}
	var prev *ListNode //@rev
	for slow != nil {  // 反转后半段 //@rev
		slow.Next, prev, slow = prev, slow, slow.Next //@rev
	}
	left, right := head, prev //@cmp
	for right != nil {        // 两头往中间比 //@cmp
		if left.Val != right.Val { //@cmp,bad
			return false //@bad
		}
		left, right = left.Next, right.Next //@cmp
	}
	return true //@done
}
