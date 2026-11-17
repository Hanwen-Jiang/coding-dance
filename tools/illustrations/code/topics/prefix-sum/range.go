type NumArray struct {
	pre []int // pre[i] 是前 i 个数的和
}

func Constructor(nums []int) NumArray {
	pre := make([]int, len(nums)+1) //@init
	for i, x := range nums {        //@build
		pre[i+1] = pre[i] + x //@build
	}
	return NumArray{pre}
}

func (this *NumArray) SumRange(left int, right int) int {
	return this.pre[right+1] - this.pre[left] // 两个前缀和相减 //@query
}
