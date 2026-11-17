func nearestExit(maze [][]byte, entrance []int) int {
	m, n := len(maze), len(maze[0])
	dirs := [4][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}}
	q := [][3]int{{entrance[0], entrance[1], 0}} // {行, 列, 走了几步} //@init
	maze[entrance[0]][entrance[1]] = '+'         // 走过的格子标成墙，不再走 //@init
	for len(q) > 0 {
		cur := q[0] //@pop
		q = q[1:]   //@pop
		for _, dir := range dirs { //@next
			a, b := cur[0]+dir[0], cur[1]+dir[1] //@next
			if a >= 0 && a < m && b >= 0 && b < n && maze[a][b] == '.' { //@next
				if a == 0 || a == m-1 || b == 0 || b == n-1 { // 到了边上：就是出口 //@exit
					return cur[2] + 1 //@exit
				}
				maze[a][b] = '+'                    // 入队时就标记 //@push
				q = append(q, [3]int{a, b, cur[2] + 1}) //@push
			}
		}
	}
	return -1 //@done
}
