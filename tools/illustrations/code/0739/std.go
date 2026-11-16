func dailyTemperatures(temperatures []int) []int {
	ans := make([]int, len(temperatures)) //@init
	stack := []int{}                      // 还在等待的日子（下标），温度从底到顶递减 //@init
	for i, t := range temperatures {
		for len(stack) > 0 && temperatures[stack[len(stack)-1]] < t { //@pop
			j := stack[len(stack)-1]   //@pop
			stack = stack[:len(stack)-1] //@pop
			ans[j] = i - j             // 第 j 天等到了第 i 天 //@pop
		}
		stack = append(stack, i) //@push
	}
	return ans //@done
}
