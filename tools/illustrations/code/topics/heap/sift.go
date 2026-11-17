type MinHeap struct {
	a []int // i 的孩子是 2i+1、2i+2
}

func Constructor() MinHeap {
	return MinHeap{} //@init
}

func (h *MinHeap) Push(x int) {
	h.a = append(h.a, x) // 先放到最后 //@push
	i := len(h.a) - 1    //@push
	for i > 0 && h.a[(i-1)/2] > h.a[i] { // 比父节点小就往上换 //@up
		p := (i - 1) / 2                //@up
		h.a[i], h.a[p] = h.a[p], h.a[i] //@up
		i = p                           //@up
	}
}

func (h *MinHeap) Pop() int {
	a := h.a
	top := a[0]         //@pop
	a[0] = a[len(a)-1]  // 最后一个挪到堆顶 //@pop
	a = a[:len(a)-1]    //@pop
	h.a = a
	i, n := 0, len(a)
	for {
		small, l, r := i, 2*i+1, 2*i+2 //@down
		if l < n && a[l] < a[small] {  //@down
			small = l //@down
		}
		if r < n && a[r] < a[small] { //@down
			small = r //@down
		}
		if small == i { // 两个孩子都不比它小 //@stop
			break //@stop
		}
		a[i], a[small] = a[small], a[i] //@down
		i = small                       //@down
	}
	return top //@ret
}

func (h *MinHeap) Peek() int {
	return h.a[0] //@peek
}

func (h *MinHeap) Size() int {
	return len(h.a) //@size
}
