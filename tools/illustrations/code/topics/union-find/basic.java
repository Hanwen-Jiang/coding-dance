class UnionFind {
    private final int[] parent, size;
    private int parts;                          // 集合的个数

    public UnionFind(int n) {
        parent = new int[n];                    //@init
        size = new int[n];                      //@init
        for (int i = 0; i < n; i++) {           //@init
            parent[i] = i;                      // 一开始每个点自己是根 //@init
            size[i] = 1;                        //@init
        }
        parts = n;                              //@init
    }

    public int find(int x) {
        while (parent[x] != x) {                // 往上走到根 //@find
            parent[x] = parent[parent[x]];      // 路径压缩：指向爷爷 //@find
            x = parent[x];                      //@find
        }
        return x;                               //@find
    }

    public boolean unite(int a, int b) {
        int ra = find(a), rb = find(b);         //@roots
        if (ra == rb) {                         // 已经在一个集合里 //@same
            return false;                       //@same
        }
        if (size[ra] < size[rb]) {              // 小树挂到大树下面 //@merge
            int t = ra; ra = rb; rb = t;        //@merge
        }
        parent[rb] = ra;                        //@merge
        size[ra] += size[rb];                   //@merge
        parts--;                                //@merge
        return true;                            //@merge
    }

    public boolean connected(int a, int b) {
        return find(a) == find(b);              //@ask
    }

    public int count() {
        return parts;                           //@count
    }
}
