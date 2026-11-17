func hammingWeight(n int) int {
	cnt := 0 //@init
	for n != 0 { //@loop
		n &= n - 1 // 去掉最低位的 1 //@drop
		cnt++      //@drop
	}
	return cnt //@done
}
