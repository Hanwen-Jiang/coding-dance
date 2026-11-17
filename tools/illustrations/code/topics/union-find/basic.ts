class UnionFind {
    private parent: number[];
    private size: number[];
    private parts: number;                      // 集合的个数

    constructor(n: number) {
        this.parent = Array.from({ length: n }, (_, i) => i);   // 一开始每个点自己是根 //@init
        this.size = new Array(n).fill(1);       //@init
        this.parts = n;                         //@init
    }

    find(x: number): number {
        while (this.parent[x] !== x) {          // 往上走到根 //@find
            this.parent[x] = this.parent[this.parent[x]];   // 路径压缩：指向爷爷 //@find
            x = this.parent[x];                 //@find
        }
        return x;                               //@find
    }

    unite(a: number, b: number): boolean {
        let ra = this.find(a), rb = this.find(b);   //@roots
        if (ra === rb) {                        // 已经在一个集合里 //@same
            return false;                       //@same
        }
        if (this.size[ra] < this.size[rb]) {    // 小树挂到大树下面 //@merge
            [ra, rb] = [rb, ra];                //@merge
        }
        this.parent[rb] = ra;                   //@merge
        this.size[ra] += this.size[rb];         //@merge
        this.parts--;                           //@merge
        return true;                            //@merge
    }

    connected(a: number, b: number): boolean {
        return this.find(a) === this.find(b);   //@ask
    }

    count(): number {
        return this.parts;                      //@count
    }
}
