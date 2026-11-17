func singleNumber(nums []int) int {
	res := 0                 //@init
	for _, x := range nums { //@xor
		res ^= x // 成对的数会互相抵消 //@xor
	}
	return res //@done
}
