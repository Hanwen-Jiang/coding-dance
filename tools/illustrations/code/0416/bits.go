func canPartition(nums []int) bool {
	total := 0
	for _, x := range nums {
		total += x
	}
	// bits 用 uint64 数组存，第 j 位是 1：能凑出和 j
	bits := make([]uint64, total/64+1) //@init
	bits[0] = 1                        //@init
	for _, x := range nums {           //@add
		// bits |= bits << x：从高位往低位算，用到的低位还没被改过
		w, b := x/64, uint(x%64)              //@add
		for i := len(bits) - 1; i >= w; i-- { //@add
			v := bits[i-w] << b      //@add
			if b > 0 && i-w-1 >= 0 { //@add
				v |= bits[i-w-1] >> (64 - b) //@add
			}
			bits[i] |= v //@add
		}
	}
	half := total / 2                                          //@done
	return total%2 == 0 && bits[half/64]>>uint(half%64)&1 == 1 //@done
}
