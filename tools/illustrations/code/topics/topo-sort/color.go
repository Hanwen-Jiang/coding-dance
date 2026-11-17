func eventualSafeNodes(graph [][]int) []int {
	color := make([]int, len(graph)) // 0 没走过，1 正在走（在递归栈上），2 安全 //@init
	var safe func(u int) bool
	safe = func(u int) bool {
		if color[u] != 0 { // 走过了：1 说明绕回来了，有环 //@seen
			return color[u] == 2 //@seen
		}
		color[u] = 1 //@enter
		for _, v := range graph[u] { //@next
			if !safe(v) { // 能走到环上，u 也不安全 //@next
				return false //@next
			}
		}
		color[u] = 2 // 走出去的路都安全 //@safe
		return true  //@safe
	}
	res := []int{} //@done
	for u := range graph { //@done
		if safe(u) { //@done
			res = append(res, u) //@done
		}
	}
	return res //@done
}
