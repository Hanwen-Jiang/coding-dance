class Solution {
public:
    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
        vector<vector<int>> graph(numCourses);                  //@init
        for (auto& p : prerequisites) {                         //@init
            graph[p[0]].push_back(p[1]);                        //@init
        }
        vector<int> state(numCourses, 0);                       // 0 没访问，1 在递归路径上，2 确认没问题 //@init
        function<bool(int)> ok = [&](int u) {
            if (state[u]) {                                     //@seen,cycle
                return state[u] == 2;                           //@seen,cycle
            }
            state[u] = 1;                                       //@enter
            for (int v : graph[u]) {                            //@enter
                if (!ok(v)) {                                   //@enter
                    return false;                               //@cycle
                }
            }
            state[u] = 2;                                       //@confirm
            return true;                                        //@confirm
        };
        for (int u = 0; u < numCourses; u++) {                  //@init,done
            if (!ok(u)) {                                       //@init,done
                return false;                                   //@done
            }
        }
        return true;                                            //@done
    }
};
