class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        int m = grid.size(), n = grid[0].size(), count = 0;     //@init
        const int dirs[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        for (int i = 0; i < m; i++) {                           //@scan
            for (int j = 0; j < n; j++) {                       //@scan
                if (grid[i][j] != '1') {
                    continue;
                }
                count++;                                        //@found
                grid[i][j] = '0';                               //@found
                stack<pair<int, int>> st;                       //@found
                st.push({i, j});                                //@found
                while (!st.empty()) {
                    auto [x, y] = st.top();                     //@pop
                    st.pop();                                   //@pop
                    for (auto& d : dirs) {                      //@expand
                        int a = x + d[0], b = y + d[1];         //@expand
                        if (a >= 0 && a < m && b >= 0 && b < n && grid[a][b] == '1') {  //@expand
                            grid[a][b] = '0';                   // 入栈时就做记号 //@expand
                            st.push({a, b});                    //@expand
                        }
                    }
                }
            }
        }
        return count;                                           //@done
    }
};
