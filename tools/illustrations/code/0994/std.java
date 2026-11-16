class Solution {
    public int orangesRotting(int[][] grid) {
        int m = grid.length, n = grid[0].length;        //@init
        Deque<int[]> q = new ArrayDeque<>();            //@init
        int fresh = 0;                                  //@init
        for (int i = 0; i < m; i++) {                   //@init
            for (int j = 0; j < n; j++) {               //@init
                if (grid[i][j] == 2) q.offer(new int[]{i, j});  //@init
                if (grid[i][j] == 1) fresh++;           //@init
            }
        }
        int minutes = 0;                                //@init
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};  //@init
        while (!q.isEmpty() && fresh > 0) {             //@minute
            minutes++;                                  //@minute
            for (int k = q.size(); k > 0; k--) {        // 这一分钟里所有烂橘子同时扩散 //@minute
                int[] p = q.poll();                     //@minute
                for (int[] d : dirs) {                  //@minute
                    int x = p[0] + d[0], y = p[1] + d[1];   //@minute
                    if (x >= 0 && x < m && y >= 0 && y < n && grid[x][y] == 1) {    //@minute
                        grid[x][y] = 2;                 //@minute
                        fresh--;                        //@minute
                        q.offer(new int[]{x, y});       //@minute
                    }
                }
            }
        }
        return fresh > 0 ? -1 : minutes;               //@done
    }
}
