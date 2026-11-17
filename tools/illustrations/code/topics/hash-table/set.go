func intersection(nums1 []int, nums2 []int) []int {
	seen := map[int]bool{} // 查一个数在不在：O(1) //@init
	for _, x := range nums1 { //@init
		seen[x] = true //@init
	}
	res := map[int]bool{} // 答案也用集合，自动去重 //@init
	for _, x := range nums2 { //@loop
		if seen[x] { //@hit
			res[x] = true //@hit
		}
	}
	ans := []int{} //@done
	for x := range res { //@done
		ans = append(ans, x) //@done
	}
	return ans //@done
}
