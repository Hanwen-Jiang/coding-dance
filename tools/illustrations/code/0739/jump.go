func dailyTemperatures(temperatures []int) []int {
	T, n := temperatures, len(temperatures) //@init
	ans := make([]int, n)                   //@init
	for i := n - 2; i >= 0; i-- {           //@start
		j := i + 1                        //@start
		for T[j] <= T[i] && ans[j] != 0 { //@jump
			j += ans[j] // 跳到比 T[j] 更热的那天 //@jump
		}
		if T[j] > T[i] { //@found,miss
			ans[i] = j - i //@found
		}
	}
	return ans //@done
}
