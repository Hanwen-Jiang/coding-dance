type nodeHeap []*ListNode // 小顶堆，按节点的值比较

func (h nodeHeap) Len() int           { return len(h) }
func (h nodeHeap) Less(i, j int) bool { return h[i].Val < h[j].Val }
func (h nodeHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *nodeHeap) Push(x any)        { *h = append(*h, x.(*ListNode)) }
func (h *nodeHeap) Pop() any {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

func mergeKLists(lists []*ListNode) *ListNode {
	h := &nodeHeap{}             //@build
	for _, node := range lists { //@build
		if node != nil { //@build
			*h = append(*h, node) //@build
		}
	}
	heap.Init(h)         //@build
	dummy := &ListNode{} //@build
	cur := dummy         //@build
	for h.Len() > 0 {
		node := heap.Pop(h).(*ListNode) //@pop
		cur.Next = node                 //@pop
		cur = node                      //@pop
		if node.Next != nil {           //@push,end
			heap.Push(h, node.Next) //@push
		}
	}
	return dummy.Next //@done
}
