class Solution {
public:
    vector<vector<int>> updateMatrix(vector<vector<int>>& mat) {
        int m = mat.size(), n = mat[0].size();
        const int dirs[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        vector<vector<int>> dist(m, vector<int>(n, -1));    // -1 表示还没走到 //@init
        queue<pair<int, int>> q;                        //@init
        for (int i = 0; i < m; i++) {                   //@seed
            for (int j = 0; j < n; j++) {               //@seed
                if (mat[i][j] == 0) {                   // 所有的 0 同时作为起点 //@seed
                    dist[i][j] = 0;                     //@seed
                    q.push({i, j});                     //@seed
                }
            }
        }
        while (!q.empty()) {
            auto [i, j] = q.front();                    //@pop
            q.pop();                                    //@pop
            for (auto& d : dirs) {                      //@next
                int a = i + d[0], b = j + d[1];         //@next
                if (a >= 0 && a < m && b >= 0 && b < n && dist[a][b] == -1) {   //@next
                    dist[a][b] = dist[i][j] + 1;        // 第一次走到就是最近的距离 //@next
                    q.push({a, b});                     //@next
                }
            }
        }
        return dist;                                    //@done
    }
};
