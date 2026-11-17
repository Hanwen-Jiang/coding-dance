class Solution {
public:
    vector<int> findOrder(int numCourses, vector<vector<int>>& prerequisites) {
        vector<vector<int>> graph(numCourses);              // 先修课 -> 后续课 //@init
        vector<int> indeg(numCourses, 0);                   // 还差几门先修课 //@init
        for (auto& p : prerequisites) {                     // 学 p[0] 之前要先学 p[1]：边 p[1] -> p[0] //@init
            graph[p[1]].push_back(p[0]);                    //@init
            indeg[p[0]]++;                                  //@init
        }
        queue<int> q;                                       // 现在就能学的课 //@start
        for (int i = 0; i < numCourses; i++) {              //@start
            if (indeg[i] == 0) q.push(i);                   //@start
        }
        vector<int> order;
        while (!q.empty()) {
            int u = q.front();                              //@pop
            q.pop();                                        //@pop
            order.push_back(u);                             //@pop
            for (int v : graph[u]) {                        // 学完 u，后续课少了一门先修 //@next
                if (--indeg[v] == 0) {                      // 先修课都学完了 //@next,ready
                    q.push(v);                              //@ready
                }
            }
        }
        return (int)order.size() == numCourses ? order : vector<int>{};     // 少了说明有环 //@done
    }
};
