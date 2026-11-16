func rotate(matrix [][]int) {
	n := len(matrix)
	flip := make([][]int, n) // 上下翻转：倒数第 i 行放到第 i 行 //@flip
	for i := range flip {    //@flip
		flip[i] = append([]int(nil), matrix[n-1-i]...) //@flip
	}
	for j := 0; j < n; j++ { // 结果的第 j 行 = 翻转后的第 j 列 //@col
		for i := 0; i < n; i++ { //@col
			matrix[j][i] = flip[i][j] //@col
		}
	}
}
