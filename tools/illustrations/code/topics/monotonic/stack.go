func finalPrices(prices []int) []int {
	ans := append([]int{}, prices...)
	stack := []int{} // 还没找到折扣的下标，价格从栈底到栈顶递增 //@init
	for i, p := range prices { //@loop
		for len(stack) > 0 && prices[stack[len(stack)-1]] >= p { // p 是它右边第一个不超过它的价格 //@pop
			ans[stack[len(stack)-1]] -= p //@pop
			stack = stack[:len(stack)-1]  //@pop
		}
		stack = append(stack, i) //@push
	}
	return ans //@done
}
