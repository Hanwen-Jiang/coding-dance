type UnionFind struct {
	parent, size []int
	parts        int // 集合的个数
}

func Constructor(n int) UnionFind {
	parent, size := make([]int, n), make([]int, n) //@init
	for i := range parent { //@init
		parent[i] = i // 一开始每个点自己是根 //@init
		size[i] = 1   //@init
	}
	return UnionFind{parent, size, n} //@init
}

func (u *UnionFind) Find(x int) int {
	for u.parent[x] != x { // 往上走到根 //@find
		u.parent[x] = u.parent[u.parent[x]] // 路径压缩：指向爷爷 //@find
		x = u.parent[x]                     //@find
	}
	return x //@find
}

func (u *UnionFind) Unite(a, b int) bool {
	ra, rb := u.Find(a), u.Find(b) //@roots
	if ra == rb { // 已经在一个集合里 //@same
		return false //@same
	}
	if u.size[ra] < u.size[rb] { // 小树挂到大树下面 //@merge
		ra, rb = rb, ra //@merge
	}
	u.parent[rb] = ra         //@merge
	u.size[ra] += u.size[rb] //@merge
	u.parts--                 //@merge
	return true               //@merge
}

func (u *UnionFind) Connected(a, b int) bool {
	return u.Find(a) == u.Find(b) //@ask
}

func (u *UnionFind) Count() int {
	return u.parts //@count
}
