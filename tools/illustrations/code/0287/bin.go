func findDuplicate(nums []int) int {
	lo, hi := 0, len(nums) // 在 [lo, hi) 里找第一个「≤ x 的数超过 x 个」的 x //@init
	for lo < hi { //@left,right
		mid := (lo + hi) / 2 //@left,right
		cnt := 0             //@left,right
		for _, v := range nums { //@left,right
			if v <= mid { //@left,right
				cnt++ //@left,right
			}
		}
		if cnt > mid { // 重复的数 ≤ mid //@left
			hi = mid //@left
		} else { //@right
			lo = mid + 1 //@right
		}
	}
	return lo //@done
}
