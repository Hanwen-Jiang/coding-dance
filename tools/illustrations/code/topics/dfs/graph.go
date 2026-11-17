func canVisitAllRooms(rooms [][]int) bool {
	seen := make([]bool, len(rooms))
	var dfs func(u int)
	dfs = func(u int) {
		seen[u] = true // 进了房间 u //@visit
		for _, v := range rooms[u] { // 用房间里的钥匙 //@next
			if !seen[v] { // 没进过的才进去 //@next
				dfs(v) //@next
			}
		}
	}
	dfs(0) //@start
	for _, s := range seen { //@done
		if !s { //@done
			return false //@done
		}
	}
	return true //@done
}
