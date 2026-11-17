class Solution {
public:
    bool validPath(int n, vector<vector<int>>& edges, int source, int destination) {
        vector<vector<int>> graph(n);                       // graph[u] 是 u 的所有邻居 //@init
        for (auto& e : edges) {                             //@edge
            graph[e[0]].push_back(e[1]);                    // 无向图：两个方向都要加 //@edge
            graph[e[1]].push_back(e[0]);                    //@edge
        }
        vector<bool> seen(n, false);                        //@start
        seen[source] = true;                                //@start
        vector<int> stack{source};                          //@start
        while (!stack.empty()) {
            int u = stack.back();                           //@pop
            stack.pop_back();                               //@pop
            if (u == destination) {                         //@found
                return true;                                //@found
            }
            for (int v : graph[u]) {                        // 只看和 u 相连的点 //@next
                if (!seen[v]) {                             //@next
                    seen[v] = true;                         //@next
                    stack.push_back(v);                     //@next
                }
            }
        }
        return false;                                       //@done
    }
};
