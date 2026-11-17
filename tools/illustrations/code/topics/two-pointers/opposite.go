func twoSum(numbers []int, target int) []int {
	l, r := 0, len(numbers)-1 // 一头一尾 //@init
	for l < r {
		s := numbers[l] + numbers[r] //@sum
		if s == target {             //@hit
			return []int{l + 1, r + 1} // 题目的下标从 1 开始 //@hit
		}
		if s < target { // 太小：numbers[l] 和谁配都不够 //@small
			l++ //@small
		} else { // 太大：numbers[r] 和谁配都太大 //@big
			r-- //@big
		}
	}
	return nil
}
