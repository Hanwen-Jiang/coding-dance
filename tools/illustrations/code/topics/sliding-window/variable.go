func minSubArrayLen(target int, nums []int) int {
	left, total := 0, 0   //@init
	best := len(nums) + 1 // 比任何窗口都长：表示还没找到 //@init
	for right, x := range nums { //@grow
		total += x // 右端进一个数 //@grow
		for total >= target { // 够了：记下长度，再试着缩短 //@shrink
			if right-left+1 < best { //@shrink
				best = right - left + 1 //@shrink
			}
			total -= nums[left] // 左端出一个数 //@shrink
			left++              //@shrink
		}
	}
	if best > len(nums) { //@done
		return 0 //@done
	}
	return best //@done
}
