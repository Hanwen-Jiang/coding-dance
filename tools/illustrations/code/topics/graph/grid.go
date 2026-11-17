func islandPerimeter(grid [][]int) int {
	dirs := [4][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}} // 上下左右 //@init
	m, n, ans := len(grid), len(grid[0]), 0            //@init
	for i := 0; i < m; i++ { //@cell
		for j := 0; j < n; j++ { //@cell
			if grid[i][j] == 0 { //@cell
				continue //@cell
			}
			for _, d := range dirs { //@dir
				a, b := i+d[0], j+d[1] // 邻居的坐标 //@dir
				if a < 0 || a >= m || b < 0 || b >= n || grid[a][b] == 0 { // 出界或者是水 //@edge
					ans++ // 这条边是周长 //@edge
				}
			}
		}
	}
	return ans //@done
}
