func numIslands(grid [][]byte) int {
	m, n, count := len(grid), len(grid[0]), 0 //@init
	dirs := [4][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}}
	for i := 0; i < m; i++ { //@scan
		for j := 0; j < n; j++ { //@scan
			if grid[i][j] != '1' {
				continue
			}
			count++                   //@found
			grid[i][j] = '0'          //@found
			stack := [][2]int{{i, j}} //@found
			for len(stack) > 0 {
				top := stack[len(stack)-1]   //@pop
				stack = stack[:len(stack)-1] //@pop
				for _, d := range dirs {     //@expand
					a, b := top[0]+d[0], top[1]+d[1]                             //@expand
					if a >= 0 && a < m && b >= 0 && b < n && grid[a][b] == '1' { //@expand
						grid[a][b] = '0'                   // 入栈时就做记号 //@expand
						stack = append(stack, [2]int{a, b}) //@expand
					}
				}
			}
		}
	}
	return count //@done
}
