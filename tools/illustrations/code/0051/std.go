func solveNQueens(n int) [][]string {
	res, queens := [][]string{}, make([]int, n)                                // queens[r]：第 r 行皇后所在的列 //@init
	cols, diag1, diag2 := make([]bool, n), make([]bool, 2*n), make([]bool, 2*n) // diag1 用 r - c + n 当下标 //@init
	var dfs func(r int)
	dfs = func(r int) {
		if r == n { //@found
			board := []string{} //@found
			for _, c := range queens { //@found
				board = append(board, strings.Repeat(".", c)+"Q"+strings.Repeat(".", n-c-1)) //@found
			}
			res = append(res, board) //@found
			return                   //@found
		}
		for c := 0; c < n; c++ { //@place
			if cols[c] || diag1[r-c+n] || diag2[r+c] { //@place
				continue // 同列或同一条斜线上已经有皇后 //@place
			}
			queens[r] = c                                      //@place
			cols[c], diag1[r-c+n], diag2[r+c] = true, true, true //@place
			dfs(r + 1)                                         //@place
			cols[c], diag1[r-c+n], diag2[r+c] = false, false, false //@back
		}
	}
	dfs(0)     //@init
	return res //@done
}
