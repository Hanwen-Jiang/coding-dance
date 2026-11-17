func canFinish(numCourses int, prerequisites [][]int) bool {
	graph := make([][]int, numCourses) //@init
	indeg := make([]int, numCourses)   // 还有几门先修课没上 //@init
	for _, p := range prerequisites {  // 先上 p[1] 才能上 p[0] //@init
		graph[p[1]] = append(graph[p[1]], p[0]) //@init
		indeg[p[0]]++                           //@init
	}
	q := []int{}                      //@init
	for i := 0; i < numCourses; i++ { //@init
		if indeg[i] == 0 { //@init
			q = append(q, i) //@init
		}
	}
	done := 0 //@init
	for len(q) > 0 {
		b := q[0]                    //@take
		q = q[1:]                    //@take
		done++                       //@take
		for _, a := range graph[b] { //@take
			indeg[a]--         //@take
			if indeg[a] == 0 { // 先修课都上完了 //@take
				q = append(q, a) //@take
			}
		}
	}
	return done == numCourses // 环上的课永远上不了 //@done
}
