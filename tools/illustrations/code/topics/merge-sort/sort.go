func sortArray(nums []int) []int {
	tmp := make([]int, len(nums))
	// 把 nums[l..r] 排好
	var mergeSort func(l, r int)
	mergeSort = func(l, r int) {
		if l >= r { //@base
			return //@base
		}
		mid := l + (r-l)/2  //@split
		mergeSort(l, mid)   // 先把两半各自排好 //@split
		mergeSort(mid+1, r) //@split
		i, j, k := l, mid+1, l // 合并两个有序的半段 //@merge
		for i <= mid && j <= r { //@merge
			if nums[i] <= nums[j] { // 相等时先拿左边的：稳定 //@take
				tmp[k] = nums[i] //@take
				i++              //@take
			} else { //@take
				tmp[k] = nums[j] //@take
				j++              //@take
			}
			k++ //@take
		}
		for i <= mid { // 一边用完了，另一边剩下的直接接上 //@rest
			tmp[k] = nums[i] //@rest
			i++              //@rest
			k++              //@rest
		}
		for j <= r { //@rest
			tmp[k] = nums[j] //@rest
			j++              //@rest
			k++              //@rest
		}
		copy(nums[l:r+1], tmp[l:r+1]) // 拷回原数组 //@copy
	}
	mergeSort(0, len(nums)-1) //@start
	return nums               //@done
}
