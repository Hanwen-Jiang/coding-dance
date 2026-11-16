class Solution {
public:
    int orangesRotting(vector<vector<int>>& grid) {
        int m = grid.size(), n = grid[0].size();        //@init
        queue<pair<int, int>> q;                        //@init
        int fresh = 0;                                  //@init
        for (int i = 0; i < m; i++) {                   //@init
            for (int j = 0; j < n; j++) {               //@init
                if (grid[i][j] == 2) q.push({i, j});    //@init
                if (grid[i][j] == 1) fresh++;           //@init
            }
        }
        int minutes = 0;                                //@init
        int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};    //@init
        while (!q.empty() && fresh > 0) {               //@minute
            minutes++;                                  //@minute
            for (int k = q.size(); k > 0; k--) {        // 这一分钟里所有烂橘子同时扩散 //@minute
                auto [i, j] = q.front(); q.pop();       //@minute
                for (auto& d : dirs) {                  //@minute
                    int x = i + d[0], y = j + d[1];     //@minute
                    if (x >= 0 && x < m && y >= 0 && y < n && grid[x][y] == 1) {    //@minute
                        grid[x][y] = 2;                 //@minute
                        fresh--;                        //@minute
                        q.push({x, y});                 //@minute
                    }
                }
            }
        }
        return fresh > 0 ? -1 : minutes;               //@done
    }
};
