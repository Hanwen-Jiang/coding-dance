func canFinish(numCourses int, prerequisites [][]int) bool {
	graph := make([][]int, numCourses) //@init
	for _, p := range prerequisites {  //@init
		graph[p[0]] = append(graph[p[0]], p[1]) //@init
	}
	state := make([]int, numCourses) // 0 没访问，1 在递归路径上，2 确认没问题 //@init
	var ok func(u int) bool
	ok = func(u int) bool {
		if state[u] != 0 { //@seen,cycle
			return state[u] == 2 //@seen,cycle
		}
		state[u] = 1                 //@enter
		for _, v := range graph[u] { //@enter
			if !ok(v) { //@enter
				return false //@cycle
			}
		}
		state[u] = 2 //@confirm
		return true  //@confirm
	}
	for u := 0; u < numCourses; u++ { //@init,done
		if !ok(u) { //@init,done
			return false //@done
		}
	}
	return true //@done
}
