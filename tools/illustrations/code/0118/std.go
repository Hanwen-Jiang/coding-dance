func generate(numRows int) [][]int {
	res := [][]int{} //@init
	for i := 0; i < numRows; i++ { //@row
		row := make([]int, i+1) // 首尾是 1 //@row
		row[0], row[i] = 1, 1    //@row
		for j := 1; j < i; j++ { //@mid
			row[j] = res[i-1][j-1] + res[i-1][j] //@mid
		}
		res = append(res, row) //@row
	}
	return res //@done
}
