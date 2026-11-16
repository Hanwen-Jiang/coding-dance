func findKthLargest(nums []int, k int) int {
	target := len(nums) - k     // 第 k 大 = 升序下标 n-k //@init
	lo, hi := 0, len(nums)-1    //@init
	for {                       //@pivot
		pivot := nums[lo+rand.Intn(hi-lo+1)] //@pivot
		lt, i, gt := lo, lo, hi // [lo,lt) 小于  [lt,i) 等于  (gt,hi] 大于 //@pivot
		for i <= gt {           //@less,more,eq
			if nums[i] < pivot { //@less
				nums[lt], nums[i] = nums[i], nums[lt] //@less
				lt++                                  //@less
				i++                                   //@less
			} else if nums[i] > pivot { //@more
				nums[i], nums[gt] = nums[gt], nums[i] //@more
				gt-- // 换过来的数还没看过，i 不动 //@more
			} else { //@eq
				i++ //@eq
			}
		}
		if target < lt { //@left
			hi = lt - 1 // 答案在小于区 //@left
		} else if target > gt { //@right
			lo = gt + 1 // 答案在大于区 //@right
		} else { //@found
			return pivot // 落在等于区，就是 pivot //@found
		}
	}
}
