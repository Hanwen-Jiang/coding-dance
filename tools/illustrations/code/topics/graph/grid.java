class Solution {
    private static final int[][] DIRS = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};    // 上下左右 //@init

    public int islandPerimeter(int[][] grid) {
        int m = grid.length, n = grid[0].length, ans = 0;   //@init
        for (int i = 0; i < m; i++) {                       //@cell
            for (int j = 0; j < n; j++) {                   //@cell
                if (grid[i][j] == 0) {                      //@cell
                    continue;                               //@cell
                }
                for (int[] d : DIRS) {                      //@dir
                    int a = i + d[0], b = j + d[1];         // 邻居的坐标 //@dir
                    if (a < 0 || a >= m || b < 0 || b >= n || grid[a][b] == 0) {    // 出界或者是水 //@edge
                        ans++;                              // 这条边是周长 //@edge
                    }
                }
            }
        }
        return ans;                                         //@done
    }
}
