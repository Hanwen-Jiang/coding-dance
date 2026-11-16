func orangesRotting(grid [][]int) int {
	m, n := len(grid), len(grid[0]) //@init
	q, fresh := [][2]int{}, 0       //@init
	for i := 0; i < m; i++ { //@init
		for j := 0; j < n; j++ { //@init
			if grid[i][j] == 2 { //@init
				q = append(q, [2]int{i, j}) //@init
			} else if grid[i][j] == 1 { //@init
				fresh++ //@init
			}
		}
	}
	minutes := 0 //@init
	dirs := [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} //@init
	for len(q) > 0 && fresh > 0 { //@minute
		minutes++ //@minute
		next := [][2]int{} // 这一分钟里所有烂橘子同时扩散 //@minute
		for _, p := range q { //@minute
			for _, d := range dirs { //@minute
				x, y := p[0]+d[0], p[1]+d[1] //@minute
				if x >= 0 && x < m && y >= 0 && y < n && grid[x][y] == 1 { //@minute
					grid[x][y] = 2 //@minute
					fresh-- //@minute
					next = append(next, [2]int{x, y}) //@minute
				}
			}
		}
		q = next //@minute
	}
	if fresh > 0 { //@done
		return -1 //@done
	}
	return minutes //@done
}
