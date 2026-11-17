// container/heap 要求自己的类型实现 Len、Less、Swap、Push、Pop
type minHeap []int

func (h minHeap) Len() int           { return len(h) }
func (h minHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h minHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *minHeap) Push(x any)        { *h = append(*h, x.(int)) }
func (h *minHeap) Pop() any {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

type KthLargest struct {
	k int
	h *minHeap // 最小堆，只留最大的 k 个数
}

func Constructor(k int, nums []int) KthLargest {
	kl := KthLargest{k, &minHeap{}} //@init
	for _, x := range nums {        //@init
		kl.Add(x) //@init
	}
	return kl
}

func (kl *KthLargest) Add(val int) int {
	heap.Push(kl.h, val)   //@push
	if kl.h.Len() > kl.k { // 多了一个：最小的那个不可能是前 k 大 //@trim
		heap.Pop(kl.h) //@trim
	}
	return (*kl.h)[0] // 堆顶就是第 k 大 //@top
}
