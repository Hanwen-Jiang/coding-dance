func updateMatrix(mat [][]int) [][]int {
	m, n := len(mat), len(mat[0])
	dirs := [4][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}}
	dist := make([][]int, m) //@init
	q := [][2]int{}          //@init
	for i := range mat { //@seed
		dist[i] = make([]int, n) //@seed
		for j := range mat[i] { //@seed
			if mat[i][j] == 0 { // 所有的 0 同时作为起点 //@seed
				q = append(q, [2]int{i, j}) //@seed
			} else { //@seed
				dist[i][j] = -1 // -1 表示还没走到 //@seed
			}
		}
	}
	for len(q) > 0 {
		cur := q[0] //@pop
		q = q[1:]   //@pop
		for _, d := range dirs { //@next
			a, b := cur[0]+d[0], cur[1]+d[1] //@next
			if a >= 0 && a < m && b >= 0 && b < n && dist[a][b] == -1 { //@next
				dist[a][b] = dist[cur[0]][cur[1]] + 1 // 第一次走到就是最近的距离 //@next
				q = append(q, [2]int{a, b})           //@next
			}
		}
	}
	return dist //@done
}
