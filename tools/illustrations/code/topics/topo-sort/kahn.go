func findOrder(numCourses int, prerequisites [][]int) []int {
	graph := make([][]int, numCourses) // 先修课 -> 后续课 //@init
	indeg := make([]int, numCourses)   // 还差几门先修课 //@init
	for _, p := range prerequisites {  // 学 p[0] 之前要先学 p[1]：边 p[1] -> p[0] //@init
		graph[p[1]] = append(graph[p[1]], p[0]) //@init
		indeg[p[0]]++                           //@init
	}
	q := []int{} // 现在就能学的课 //@start
	for i, d := range indeg { //@start
		if d == 0 { //@start
			q = append(q, i) //@start
		}
	}
	order := []int{}
	for len(q) > 0 {
		u := q[0]                //@pop
		q = q[1:]                //@pop
		order = append(order, u) //@pop
		for _, v := range graph[u] { // 学完 u，后续课少了一门先修 //@next
			indeg[v]--         //@next
			if indeg[v] == 0 { // 先修课都学完了 //@ready
				q = append(q, v) //@ready
			}
		}
	}
	if len(order) < numCourses { // 少了说明有环 //@done
		return []int{} //@done
	}
	return order //@done
}
