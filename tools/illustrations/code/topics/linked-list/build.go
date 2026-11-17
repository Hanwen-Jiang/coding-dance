/**
 * 力扣已经定义好了 ListNode：
 * type ListNode struct {
 *     Val  int
 *     Next *ListNode
 * }
 */
func buildList(nums []int) *ListNode {
	dummy := &ListNode{} // 哑节点：省掉「链表还是空的」这个特殊情况 //@init
	tail := dummy        //@init
	for _, x := range nums { //@loop
		tail.Next = &ListNode{Val: x} // 新建节点，接到尾巴后面 //@link
		tail = tail.Next              // 尾巴往后挪 //@move
	}
	return dummy.Next // 真正的头是哑节点的下一个 //@done
}
