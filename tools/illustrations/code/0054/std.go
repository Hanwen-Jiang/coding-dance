func spiralOrder(matrix [][]int) []int {
	res := []int{}                     //@init
	top, bottom := 0, len(matrix)-1    //@init
	left, right := 0, len(matrix[0])-1 //@init
	for top <= bottom && left <= right {
		for j := left; j <= right; j++ { // 上边：左 -> 右 //@top
			res = append(res, matrix[top][j]) //@top
		}
		top++                            //@top
		for i := top; i <= bottom; i++ { // 右边：上 -> 下 //@right
			res = append(res, matrix[i][right]) //@right
		}
		right--            //@right
		if top <= bottom { //@bottom,skipb
			for j := right; j >= left; j-- { // 下边：右 -> 左 //@bottom
				res = append(res, matrix[bottom][j]) //@bottom
			}
			bottom-- //@bottom
		}
		if left <= right { //@left,skipl
			for i := bottom; i >= top; i-- { // 左边：下 -> 上 //@left
				res = append(res, matrix[i][left]) //@left
			}
			left++ //@left
		}
	}
	return res //@done
}
