class UnionFind {
    vector<int> parent, size;
    int parts;                                  // 集合的个数

public:
    UnionFind(int n) : parent(n), size(n, 1), parts(n) {    //@init
        iota(parent.begin(), parent.end(), 0);  // 一开始每个点自己是根 //@init
    }

    int find(int x) {
        while (parent[x] != x) {                // 往上走到根 //@find
            parent[x] = parent[parent[x]];      // 路径压缩：指向爷爷 //@find
            x = parent[x];                      //@find
        }
        return x;                               //@find
    }

    bool unite(int a, int b) {
        int ra = find(a), rb = find(b);         //@roots
        if (ra == rb) {                         // 已经在一个集合里 //@same
            return false;                       //@same
        }
        if (size[ra] < size[rb]) {              // 小树挂到大树下面 //@merge
            swap(ra, rb);                       //@merge
        }
        parent[rb] = ra;                        //@merge
        size[ra] += size[rb];                   //@merge
        parts--;                                //@merge
        return true;                            //@merge
    }

    bool connected(int a, int b) {
        return find(a) == find(b);              //@ask
    }

    int count() {
        return parts;                           //@count
    }
};
