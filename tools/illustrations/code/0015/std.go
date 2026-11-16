func threeSum(nums []int) [][]int {
	sort.Ints(nums) //@sort
	n := len(nums)  //@sort
	res := [][]int{} //@sort
	for i := 0; i < n-2; i++ {
		if nums[i] > 0 { //@stop
			break // 最小的都大于 0，后面不可能了 //@stop
		}
		if i > 0 && nums[i] == nums[i-1] { //@skip
			continue // 第一个数去重 //@skip
		}
		l, r := i+1, n-1 //@fix
		for l < r {
			s := nums[i] + nums[l] + nums[r] //@small,big,found
			if s < 0 { //@small
				l++ //@small
			} else if s > 0 { //@big
				r-- //@big
			} else {
				res = append(res, []int{nums[i], nums[l], nums[r]}) //@found
				l++                                                 //@found
				r--                                                 //@found
				for l < r && nums[l] == nums[l-1] {                 //@found
					l++ // 第二个数去重 //@found
				}
				for l < r && nums[r] == nums[r+1] { //@found
					r-- // 第三个数去重 //@found
				}
			}
		}
	}
	return res //@done
}
