class Solution {
    private int[] parent;

    private int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }

    public int[] findRedundantConnection(int[][] edges) {
        parent = new int[edges.length + 1];         // 点的编号是 1 到 n //@init
        for (int i = 0; i < parent.length; i++) {   //@init
            parent[i] = i;                          //@init
        }
        for (int[] e : edges) {                     //@edge
            int ru = find(e[0]), rv = find(e[1]);   //@edge
            if (ru == rv) {                         // 已经连通，再连就成环了 //@found
                return e;                           //@found
            }
            parent[ru] = rv;                        //@union
        }
        return new int[0];
    }
}
