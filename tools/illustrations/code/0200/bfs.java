class Solution {
    private static final int[][] DIRS = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};

    public int numIslands(char[][] grid) {
        int m = grid.length, n = grid[0].length, count = 0;     //@init
        for (int i = 0; i < m; i++) {                           //@scan
            for (int j = 0; j < n; j++) {                       //@scan
                if (grid[i][j] != '1') {
                    continue;
                }
                count++;                                        //@found
                grid[i][j] = '0';                               //@found
                Deque<int[]> q = new ArrayDeque<>();            //@found
                q.offer(new int[]{i, j});                       //@found
                while (!q.isEmpty()) {
                    int[] cur = q.poll();                       //@pop
                    for (int[] d : DIRS) {                      //@expand
                        int a = cur[0] + d[0], b = cur[1] + d[1];   //@expand
                        if (a >= 0 && a < m && b >= 0 && b < n && grid[a][b] == '1') {  //@expand
                            grid[a][b] = '0';                   // 入队时就做记号 //@expand
                            q.offer(new int[]{a, b});           //@expand
                        }
                    }
                }
            }
        }
        return count;                                           //@done
    }
}
