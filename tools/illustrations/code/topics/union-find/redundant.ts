function findRedundantConnection(edges: number[][]): number[] {
    const parent = Array.from({ length: edges.length + 1 }, (_, i) => i);   // 点的编号是 1 到 n //@init
    const find = (x: number): number => {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };
    for (const [u, v] of edges) {               //@edge
        const ru = find(u), rv = find(v);       //@edge
        if (ru === rv) {                        // 已经连通，再连就成环了 //@found
            return [u, v];                      //@found
        }
        parent[ru] = rv;                        //@union
    }
    return [];
}
