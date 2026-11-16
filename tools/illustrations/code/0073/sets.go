func setZeroes(matrix [][]int) {
	m, n := len(matrix), len(matrix[0])
	rows, cols := make([]bool, m), make([]bool, n) // 要清零的行、列
	for i := 0; i < m; i++ { //@find
		for j := 0; j < n; j++ { //@find
			if matrix[i][j] == 0 { //@find
				rows[i], cols[j] = true, true //@find
			}
		}
	}
	for i := 0; i < m; i++ { //@clear
		for j := 0; j < n; j++ { //@clear
			if rows[i] || cols[j] { //@clear
				matrix[i][j] = 0 //@clear
			}
		}
	}
}
