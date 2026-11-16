func lengthOfLIS(nums []int) int {
	tails := []int{} // tails[k]：长度 k+1 的递增子序列的最小结尾 //@init
	for _, x := range nums {
		k := sort.SearchInts(tails, x) // 第一个 >= x 的位置 //@add,rep
		if k == len(tails) {           //@add,rep
			tails = append(tails, x) // 比所有结尾都大，接在最后 //@add
		} else {
			tails[k] = x // 换成更小的结尾 //@rep
		}
	}
	return len(tails) //@done
}
