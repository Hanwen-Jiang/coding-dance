func mergeKLists(lists []*ListNode) *ListNode {
	if len(lists) == 0 { //@empty
		return nil //@empty
	}
	n := len(lists)
	for n > 1 { // 每一轮个数减半 //@round
		m := 0
		for i := 0; i < n; i += 2 { // 相邻两个合并，结果放回前面 //@merge,single
			var b *ListNode //@merge,single
			if i+1 < n {    //@merge,single
				b = lists[i+1] //@merge,single
			}
			lists[m] = merge2(lists[i], b) //@merge,single
			m++
		}
		n = m //@round
	}
	return lists[0] //@done
}

// 合并两个有序链表
func merge2(a, b *ListNode) *ListNode {
	dummy := &ListNode{}       //@merge
	cur := dummy               //@merge
	for a != nil && b != nil { //@merge
		if a.Val <= b.Val { //@merge
			cur.Next, a = a, a.Next //@merge
		} else { //@merge
			cur.Next, b = b, b.Next //@merge
		}
		cur = cur.Next //@merge
	}
	if a != nil { //@merge,single
		cur.Next = a //@merge,single
	} else { //@merge,single
		cur.Next = b //@merge,single
	}
	return dummy.Next //@merge,single
}
