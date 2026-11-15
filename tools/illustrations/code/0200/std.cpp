class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        int m = grid.size(), n = grid[0].size();    //@init
        int count = 0;                              //@init
        for (int i = 0; i < m; i++) {               //@scan
            for (int j = 0; j < n; j++) {           //@scan
                if (grid[i][j] == '1') {            //@found
                    count++;                        //@found
                    sink(grid, i, j);               //@found
                }
            }
        }
        return count;                               //@done
    }

private:
    void sink(vector<vector<char>>& grid, int i, int j) {
        if (i < 0 || j < 0 || i >= (int)grid.size() || j >= (int)grid[0].size() || grid[i][j] != '1') {
            return;                 // 越界或不是陆地
        }
        grid[i][j] = '0';           // 先做记号，再扩散 //@mark
        sink(grid, i - 1, j);       //@spread
        sink(grid, i + 1, j);       //@spread
        sink(grid, i, j - 1);       //@spread
        sink(grid, i, j + 1);       //@spread
    }
};
