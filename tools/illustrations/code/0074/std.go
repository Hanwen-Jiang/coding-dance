func searchMatrix(matrix [][]int, target int) bool {
	m, n := len(matrix), len(matrix[0]) //@init
	lo, hi := 0, m*n-1                  // 当成长度 m·n 的有序数组 //@init
	for lo <= hi { //@loop
		mid := (lo + hi) / 2         //@loop
		x := matrix[mid/n][mid%n]    // 一维下标换回行列 //@loop
		if x == target { //@found
			return true //@found
		}
		if x < target { //@small
			lo = mid + 1 //@small
		} else { //@big
			hi = mid - 1 //@big
		}
	}
	return false //@none
}
