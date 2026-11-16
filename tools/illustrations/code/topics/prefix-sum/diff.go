func corpFlightBookings(bookings [][]int, n int) []int {
	diff := make([]int, n+1) // diff[i] = ans[i] - ans[i-1] //@init
	for _, b := range bookings { //@add
		diff[b[0]-1] += b[2] // 从 first 开始多了 seats //@add
		diff[b[1]] -= b[2]   // 过了 last 又少了 seats //@add
	}
	ans := make([]int, n)
	cur := 0
	for i := 0; i < n; i++ { //@sum
		cur += diff[i] // 前缀和还原出每个位置的值 //@sum
		ans[i] = cur   //@sum
	}
	return ans //@done
}
