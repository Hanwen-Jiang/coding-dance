func rotate(matrix [][]int) {
	n := len(matrix) //@init
	for i := 0; i < n; i++ { //@swap
		for j := i + 1; j < n; j++ { // 只换对角线上方的一半 //@swap
			matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j] //@swap
		}
	}
	for _, row := range matrix { //@flip
		for l, r := 0, n-1; l < r; l, r = l+1, r-1 { // 左右翻转这一行 //@flip
			row[l], row[r] = row[r], row[l] //@flip
		}
	}
}
