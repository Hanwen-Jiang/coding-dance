func twoSum(nums []int, target int) []int {
	seen := map[int]int{} // 数值 -> 下标 //@init
	for i, x := range nums {
		if j, ok := seen[target-x]; ok { // 先查 //@check
			return []int{j, i} //@found
		}
		seen[x] = i // 再存 //@save
	}
	return nil
}
