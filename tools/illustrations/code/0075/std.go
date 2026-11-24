func sortColors(nums []int) {
	lo, i, hi := 0, 0, len(nums)-1 // [0,lo) 是 0，[lo,i) 是 1，(hi,end] 是 2 //@init
	for i <= hi {                  //@loop
		if nums[i] == 0 { //@chk0
			nums[lo], nums[i] = nums[i], nums[lo] //@swap0
			lo++                                  //@adv0
			i++                                   //@adv0
		} else if nums[i] == 2 { //@chk2
			nums[i], nums[hi] = nums[hi], nums[i] //@swap2
			hi--                                  // 换过来的数还没看过，i 不动 //@adv2
		} else { //@one
			i++ //@one
		}
	}
}
