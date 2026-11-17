func countBits(n int) []int {
	ans := make([]int, n+1) // ans[0] = 0 //@init
	for i := 1; i <= n; i++ { //@loop
		ans[i] = ans[i>>1] + i&1 // 去掉最低位的数已经算过了，再加上最低位 //@calc
	}
	return ans //@done
}
