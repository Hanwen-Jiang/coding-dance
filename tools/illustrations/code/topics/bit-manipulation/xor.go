func missingNumber(nums []int) int {
	x := len(nums) // 0..n 里的 n 先放进来 //@init
	for i, v := range nums { //@loop
		x ^= i ^ v // 出现两次的数异或后抵消 //@xor
	}
	return x //@done
}
