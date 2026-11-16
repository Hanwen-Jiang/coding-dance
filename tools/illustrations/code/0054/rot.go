func spiralOrder(matrix [][]int) []int {
	res := []int{} //@init
	for len(matrix) > 0 {
		res = append(res, matrix[0]...) // 拿走第一行 //@take
		matrix = matrix[1:]             //@take
		// 剩下的逆时针转 90°：从最右一列开始，每一列变成新的一行
		next := [][]int{}    //@turn
		cols := 0            //@turn
		if len(matrix) > 0 { //@turn
			cols = len(matrix[0]) //@turn
		}
		for c := cols - 1; c >= 0; c-- { //@turn
			row := []int{}             //@turn
			for _, r := range matrix { //@turn
				row = append(row, r[c]) //@turn
			}
			next = append(next, row) //@turn
		}
		matrix = next //@turn
	}
	return res //@done
}
