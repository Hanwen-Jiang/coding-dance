func exist(board [][]byte, word string) bool {
	m, n := len(board), len(board[0]) //@init
	var dfs func(i, j, k int) bool
	dfs = func(i, j, k int) bool {
		if board[i][j] != word[k] { //@match
			return false
		}
		if k == len(word)-1 { //@found
			return true //@found
		}
		board[i][j] = '#'                                              // 占住这个格子 //@match
		for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} { //@match
			x, y := i+d[0], j+d[1]                                    //@match
			if x >= 0 && x < m && y >= 0 && y < n && dfs(x, y, k+1) { //@match
				board[i][j] = word[k]
				return true
			}
		}
		board[i][j] = word[k] // 回溯：还原 //@back
		return false          //@back
	}
	for i := 0; i < m; i++ { //@start
		for j := 0; j < n; j++ { //@start
			if dfs(i, j, 0) { //@start
				return true //@yes
			}
		}
	}
	return false //@no
}
