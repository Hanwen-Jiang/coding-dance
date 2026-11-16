func subarraySum(nums []int, k int) int {
	count := map[int]int{0: 1} // 空前缀 //@init
	pre, res := 0, 0           //@init
	for _, x := range nums {   //@query
		pre += x             //@query
		res += count[pre-k] // 先查 //@query
		count[pre]++        // 再存 //@store
	}
	return res //@done
}
