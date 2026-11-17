func setZeroes(matrix [][]int) {
	m, n := len(matrix), len(matrix[0]) //@first
	row0, col0 := false, false          //@first
	for j := 0; j < n; j++ {            // 第一行原来有没有 0 //@first
		if matrix[0][j] == 0 { //@first
			row0 = true //@first
		}
	}
	for i := 0; i < m; i++ { // 第一列原来有没有 0 //@first
		if matrix[i][0] == 0 { //@first
			col0 = true //@first
		}
	}
	for i := 1; i < m; i++ {
		for j := 1; j < n; j++ {
			if matrix[i][j] == 0 { //@mark
				matrix[i][0], matrix[0][j] = 0, 0 // 做记号 //@mark
			}
		}
	}
	for i := 1; i < m; i++ { //@clear
		for j := 1; j < n; j++ { //@clear
			if matrix[i][0] == 0 || matrix[0][j] == 0 { //@clear
				matrix[i][j] = 0 //@clear
			}
		}
	}
	if row0 { //@edge
		for j := 0; j < n; j++ { //@edge
			matrix[0][j] = 0 //@edge
		}
	}
	if col0 { //@edge
		for i := 0; i < m; i++ { //@edge
			matrix[i][0] = 0 //@edge
		}
	}
}
