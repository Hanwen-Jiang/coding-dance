class Solution {
    vector<int> parent;

    int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }

public:
    vector<int> findRedundantConnection(vector<vector<int>>& edges) {
        parent.resize(edges.size() + 1);            // 点的编号是 1 到 n //@init
        iota(parent.begin(), parent.end(), 0);      //@init
        for (auto& e : edges) {                     //@edge
            int ru = find(e[0]), rv = find(e[1]);   //@edge
            if (ru == rv) {                         // 已经连通，再连就成环了 //@found
                return e;                           //@found
            }
            parent[ru] = rv;                        //@union
        }
        return {};
    }
};
