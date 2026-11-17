class Solution {
    vector<int> color;                          // 0 没走过，1 正在走（在递归栈上），2 安全

    bool safe(vector<vector<int>>& graph, int u) {
        if (color[u]) {                         // 走过了：1 说明绕回来了，有环 //@seen
            return color[u] == 2;               //@seen
        }
        color[u] = 1;                           //@enter
        for (int v : graph[u]) {                //@next
            if (!safe(graph, v)) {              // 能走到环上，u 也不安全 //@next
                return false;                   //@next
            }
        }
        color[u] = 2;                           // 走出去的路都安全 //@safe
        return true;                            //@safe
    }

public:
    vector<int> eventualSafeNodes(vector<vector<int>>& graph) {
        color.assign(graph.size(), 0);          //@init
        vector<int> res;                        //@done
        for (int u = 0; u < (int)graph.size(); u++) {   //@done
            if (safe(graph, u)) res.push_back(u);   //@done
        }
        return res;                             //@done
    }
};
