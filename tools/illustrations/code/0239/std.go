func maxSlidingWindow(nums []int, k int) []int {
	q, res := []int{}, []int{} // q 存下标，对应的值递减 //@init
	for i, x := range nums {
		for len(q) > 0 && nums[q[len(q)-1]] <= x { //@push
			q = q[:len(q)-1] // 队尾比新数小，没用了 //@push
		}
		q = append(q, i) //@push
		if q[0] <= i-k { //@expire
			q = q[1:] // 队头滑出窗口 //@expire
		}
		if i >= k-1 { //@record
			res = append(res, nums[q[0]]) //@record
		}
	}
	return res //@done
}
