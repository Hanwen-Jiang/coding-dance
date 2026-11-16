type minHeap struct{ sort.IntSlice } // 小顶堆：Less 是升序

func (h *minHeap) Push(v any) { h.IntSlice = append(h.IntSlice, v.(int)) }
func (h *minHeap) Pop() any {
	a := h.IntSlice
	v := a[len(a)-1]
	h.IntSlice = a[:len(a)-1]
	return v
}

func findKthLargest(nums []int, k int) int {
	h := &minHeap{append([]int(nil), nums[:k]...)} //@push
	heap.Init(h)                                   // 先放前 k 个，建小顶堆 //@push
	for _, x := range nums[k:] {
		if x > h.IntSlice[0] { // 比堆顶大，才有资格进前 k //@replace,skip
			h.IntSlice[0] = x  //@replace
			heap.Fix(h, 0)     //@replace
		}
	}
	return h.IntSlice[0] //@done
}
