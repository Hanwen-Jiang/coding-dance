func findKthLargest(nums []int, k int) int {
	target := len(nums) - k     // 第 k 大 = 从小到大排好后下标 n-k 的数 //@init
	l, r := 0, len(nums)-1      //@init
	for l < r {
		pivot := nums[l+(r-l)/2] //@pivot
		i, j := l-1, r+1         //@pivot
		for i < j {
			i++                   //@scan
			for nums[i] < pivot { //@scan
				i++ //@scan
			}
			j--                   //@scan
			for nums[j] > pivot { //@scan
				j-- //@scan
			}
			if i < j { //@swap
				nums[i], nums[j] = nums[j], nums[i] //@swap
			}
		}
		if target <= j { // 答案在左边一段 //@go
			r = j //@go
		} else { // 答案在右边一段 //@go
			l = j + 1 //@go
		}
	}
	return nums[l] //@done
}
