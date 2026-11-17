func maxAreaOfIsland(grid [][]int) int {
	m, n := len(grid), len(grid[0])
	// 从 (i, j) 出发能淹掉多少块陆地
	var dfs func(i, j int) int
	dfs = func(i, j int) int {
		if i < 0 || i >= m || j < 0 || j >= n || grid[i][j] != 1 { // 出界、是水、或者来过 //@base
			return 0 //@base
		}
		grid[i][j] = 2 // 标记来过 //@mark
		return 1 + dfs(i-1, j) + dfs(i+1, j) + dfs(i, j-1) + dfs(i, j+1) //@spread
	}
	best := 0
	for i := 0; i < m; i++ { //@scan
		for j := 0; j < n; j++ { //@scan
			if a := dfs(i, j); a > best { //@scan
				best = a //@scan
			}
		}
	}
	return best //@done
}
