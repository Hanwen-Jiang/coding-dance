class Solution {
public:
    bool exist(vector<vector<char>>& board, string word) {
        int m = board.size(), n = board[0].size();  //@init
        function<bool(int, int, int)> dfs = [&](int i, int j, int k) {
            if (board[i][j] != word[k]) {           //@match
                return false;
            }
            if (k == (int)word.size() - 1) {        //@found
                return true;                        //@found
            }
            board[i][j] = '#';                      // 占住这个格子 //@match
            int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
            for (auto& d : dirs) {                  //@match
                int x = i + d[0], y = j + d[1];     //@match
                if (x >= 0 && x < m && y >= 0 && y < n && dfs(x, y, k + 1)) {   //@match
                    board[i][j] = word[k];
                    return true;
                }
            }
            board[i][j] = word[k];                  // 回溯：还原 //@back
            return false;                           //@back
        };
        for (int i = 0; i < m; i++) {               //@start
            for (int j = 0; j < n; j++) {           //@start
                if (dfs(i, j, 0)) {                 //@start
                    return true;                    //@yes
                }
            }
        }
        return false;                               //@no
    }
};
