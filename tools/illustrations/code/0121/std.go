func maxProfit(prices []int) int {
	minPrice, best := math.MaxInt, 0 //@init
	for _, p := range prices {
		minPrice = min(minPrice, p)   // 到今天为止的最低价 //@low
		best = max(best, p-minPrice) // 今天卖出能赚多少 //@sell
	}
	return best //@done
}
