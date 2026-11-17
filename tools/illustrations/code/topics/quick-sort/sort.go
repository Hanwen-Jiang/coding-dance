func sortArray(nums []int) []int {
	// 把 nums[l..r] 排好
	var quick func(l, r int)
	quick = func(l, r int) {
		if l >= r { // 只剩 0 或 1 个数 //@base
			return //@base
		}
		pivot := nums[l+(r-l)/2] // 取中间的数当基准 //@pivot
		i, j := l-1, r+1         //@pivot
		for i < j {
			i++                   //@scan
			for nums[i] < pivot { // 左边找一个 >= pivot 的 //@scan
				i++ //@scan
			}
			j--                   //@scan
			for nums[j] > pivot { // 右边找一个 <= pivot 的 //@scan
				j-- //@scan
			}
			if i < j { //@swap
				nums[i], nums[j] = nums[j], nums[i] // 交换以后两边都对了 //@swap
			}
		}
		quick(l, j)     // [l, j] 都 <= pivot //@recur
		quick(j+1, r)   // [j+1, r] 都 >= pivot //@recur
	}
	quick(0, len(nums)-1) //@start
	return nums           //@done
}
