// 小顶堆，元素是 [次数, 数]
type pairHeap [][2]int

func (h pairHeap) Len() int           { return len(h) }
func (h pairHeap) Less(i, j int) bool { return h[i][0] < h[j][0] }
func (h pairHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *pairHeap) Push(v any)        { *h = append(*h, v.([2]int)) }
func (h *pairHeap) Pop() any {
	a := *h
	v := a[len(a)-1]
	*h = a[:len(a)-1]
	return v
}

func topKFrequent(nums []int, k int) []int {
	cnt := map[int]int{}     //@count
	for _, x := range nums { //@count
		cnt[x]++ //@count
	}
	h := &pairHeap{} // 小顶堆，只留次数最多的 k 个 //@count
	for x, c := range cnt {
		heap.Push(h, [2]int{c, x}) //@push,pop
		if h.Len() > k {           //@push,pop
			heap.Pop(h) // 挤掉次数最少的 //@pop
		}
	}
	res := []int{}         //@done
	for _, p := range *h { //@done
		res = append(res, p[1]) //@done
	}
	return res //@done
}
