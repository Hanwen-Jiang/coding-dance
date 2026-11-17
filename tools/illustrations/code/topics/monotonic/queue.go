func minSlidingWindow(nums []int, k int) []int {
	q := []int{}   // 存下标，对应的值从队头到队尾递增 //@init
	res := []int{} //@init
	for i, x := range nums { //@loop
		for len(q) > 0 && nums[q[len(q)-1]] >= x { // 比 x 大的以后不可能是最小值了 //@pop
			q = q[:len(q)-1] //@pop
		}
		q = append(q, i) //@push
		if q[0] <= i-k { // 队头滑出了窗口 //@expire
			q = q[1:] //@expire
		}
		if i >= k-1 { // 窗口满了：队头就是最小值 //@record
			res = append(res, nums[q[0]]) //@record
		}
	}
	return res //@done
}
