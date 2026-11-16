func firstMissingPositive(nums []int) int {
	n := len(nums) //@init
	for i := 0; i < n; i++ {
		// nums[i] 应该放在下标 nums[i] - 1，那里还不是它，就换过去
		for nums[i] >= 1 && nums[i] <= n && nums[nums[i]-1] != nums[i] { //@swap,stay
			j := nums[i] - 1                     //@swap
			nums[i], nums[j] = nums[j], nums[i] //@swap
		}
	}
	for i := 0; i < n; i++ { //@scan
		if nums[i] != i+1 { //@scan
			return i + 1 //@scan
		}
	}
	return n + 1 //@done
}
