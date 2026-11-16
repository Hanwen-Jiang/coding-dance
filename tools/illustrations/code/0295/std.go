type intHeap struct{ sort.IntSlice } // 小顶堆

func (h *intHeap) Push(v any) { h.IntSlice = append(h.IntSlice, v.(int)) }
func (h *intHeap) Pop() any {
	a := h.IntSlice
	v := a[len(a)-1]
	h.IntSlice = a[:len(a)-1]
	return v
}

type MedianFinder struct {
	lo intHeap // 存相反数当大顶堆，较小的一半
	hi intHeap // 小顶堆，较大的一半
}

func Constructor() MedianFinder {
	return MedianFinder{} //@init
}

func (m *MedianFinder) AddNum(num int) {
	heap.Push(&m.lo, -num)                   //@add
	heap.Push(&m.hi, -heap.Pop(&m.lo).(int)) // lo 的最大值挪到 hi //@add
	if m.hi.Len() > m.lo.Len() {             // 保持 lo 不比 hi 少 //@add,rebal
		heap.Push(&m.lo, -heap.Pop(&m.hi).(int)) //@rebal
	}
}

func (m *MedianFinder) FindMedian() float64 {
	if m.lo.Len() > m.hi.Len() { //@odd,even
		return float64(-m.lo.IntSlice[0]) //@odd
	}
	return float64(-m.lo.IntSlice[0]+m.hi.IntSlice[0]) / 2 //@even
}
