class Solution {
public:
    int maxAreaOfIsland(vector<vector<int>>& grid) {
        int m = grid.size(), n = grid[0].size();
        // 从 (i, j) 出发能淹掉多少块陆地
        function<int(int, int)> dfs = [&](int i, int j) {
            if (i < 0 || i >= m || j < 0 || j >= n || grid[i][j] != 1) {    // 出界、是水、或者来过 //@base
                return 0;                               //@base
            }
            grid[i][j] = 2;                             // 标记来过 //@mark
            return 1 + dfs(i - 1, j) + dfs(i + 1, j) + dfs(i, j - 1) + dfs(i, j + 1);  //@spread
        };
        int best = 0;
        for (int i = 0; i < m; i++) {                   //@scan
            for (int j = 0; j < n; j++) {               //@scan
                best = max(best, dfs(i, j));            //@scan
            }
        }
        return best;                                    //@done
    }
};
