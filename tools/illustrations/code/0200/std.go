func numIslands(grid [][]byte) int {
	m, n := len(grid), len(grid[0]) //@init
	var sink func(i, j int)
	sink = func(i, j int) {
		if i < 0 || j < 0 || i >= m || j >= n || grid[i][j] != '1' {
			return // 越界或不是陆地
		}
		grid[i][j] = '0' // 先做记号，再扩散 //@mark
		sink(i-1, j)     //@spread
		sink(i+1, j)     //@spread
		sink(i, j-1)     //@spread
		sink(i, j+1)     //@spread
	}
	count := 0               //@init
	for i := 0; i < m; i++ { //@scan
		for j := 0; j < n; j++ { //@scan
			if grid[i][j] == '1' { //@found
				count++    //@found
				sink(i, j) //@found
			}
		}
	}
	return count //@done
}
