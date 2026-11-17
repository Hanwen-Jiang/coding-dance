class Solution {
public:
    int islandPerimeter(vector<vector<int>>& grid) {
        const int dirs[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};     // 上下左右 //@init
        int m = grid.size(), n = grid[0].size(), ans = 0;   //@init
        for (int i = 0; i < m; i++) {                       //@cell
            for (int j = 0; j < n; j++) {                   //@cell
                if (grid[i][j] == 0) {                      //@cell
                    continue;                               //@cell
                }
                for (auto& d : dirs) {                      //@dir
                    int a = i + d[0], b = j + d[1];         // 邻居的坐标 //@dir
                    if (a < 0 || a >= m || b < 0 || b >= n || grid[a][b] == 0) {    // 出界或者是水 //@edge
                        ans++;                              // 这条边是周长 //@edge
                    }
                }
            }
        }
        return ans;                                         //@done
    }
};
