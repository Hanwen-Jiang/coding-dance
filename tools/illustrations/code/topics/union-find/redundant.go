func findRedundantConnection(edges [][]int) []int {
	parent := make([]int, len(edges)+1) // 点的编号是 1 到 n //@init
	for i := range parent { //@init
		parent[i] = i //@init
	}
	find := func(x int) int {
		for parent[x] != x {
			parent[x] = parent[parent[x]]
			x = parent[x]
		}
		return x
	}
	for _, e := range edges { //@edge
		ru, rv := find(e[0]), find(e[1]) //@edge
		if ru == rv { // 已经连通，再连就成环了 //@found
			return e //@found
		}
		parent[ru] = rv //@union
	}
	return nil
}
