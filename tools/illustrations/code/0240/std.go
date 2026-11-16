func searchMatrix(matrix [][]int, target int) bool {
	i, j := 0, len(matrix[0])-1 // 右上角 //@init
	for i < len(matrix) && j >= 0 {
		x := matrix[i][j] //@cmp
		if x == target {  //@found
			return true //@found
		}
		if x > target { //@left
			j-- // 这一列都太大 //@left
		} else {
			i++ // 这一行都太小 //@down
		}
	}
	return false //@none
}
