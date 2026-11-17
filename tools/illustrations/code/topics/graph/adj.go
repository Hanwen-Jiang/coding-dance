func validPath(n int, edges [][]int, source int, destination int) bool {
	graph := make([][]int, n) // graph[u] 是 u 的所有邻居 //@init
	for _, e := range edges { //@edge
		graph[e[0]] = append(graph[e[0]], e[1]) // 无向图：两个方向都要加 //@edge
		graph[e[1]] = append(graph[e[1]], e[0]) //@edge
	}
	seen := make([]bool, n) //@start
	seen[source] = true     //@start
	stack := []int{source}  //@start
	for len(stack) > 0 {
		u := stack[len(stack)-1]     //@pop
		stack = stack[:len(stack)-1] //@pop
		if u == destination { //@found
			return true //@found
		}
		for _, v := range graph[u] { // 只看和 u 相连的点 //@next
			if !seen[v] { //@next
				seen[v] = true            //@next
				stack = append(stack, v) //@next
			}
		}
	}
	return false //@done
}
