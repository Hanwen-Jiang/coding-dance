class Solution {
public:
    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
        vector<vector<int>> graph(numCourses);                  //@init
        vector<int> indeg(numCourses, 0);                       // 还有几门先修课没上 //@init
        for (auto& p : prerequisites) {                         // 先上 p[1] 才能上 p[0] //@init
            graph[p[1]].push_back(p[0]);                        //@init
            indeg[p[0]]++;                                      //@init
        }
        queue<int> q;                                           //@init
        for (int i = 0; i < numCourses; i++) {                  //@init
            if (indeg[i] == 0) q.push(i);                       //@init
        }
        int done = 0;                                           //@init
        while (!q.empty()) {
            int b = q.front();                                  //@take
            q.pop();                                            //@take
            done++;                                             //@take
            for (int a : graph[b]) {                            //@take
                if (--indeg[a] == 0) {                          // 先修课都上完了 //@take
                    q.push(a);                                  //@take
                }
            }
        }
        return done == numCourses;                              // 环上的课永远上不了 //@done
    }
};
