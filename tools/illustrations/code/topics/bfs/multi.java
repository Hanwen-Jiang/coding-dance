class Solution {
    public int[][] updateMatrix(int[][] mat) {
        int m = mat.length, n = mat[0].length;
        int[][] dirs = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        int[][] dist = new int[m][n];                   //@init
        Deque<int[]> q = new ArrayDeque<>();            //@init
        for (int i = 0; i < m; i++) {                   //@seed
            for (int j = 0; j < n; j++) {               //@seed
                if (mat[i][j] == 0) {                   // 所有的 0 同时作为起点 //@seed
                    q.offer(new int[]{i, j});           //@seed
                } else {                                //@seed
                    dist[i][j] = -1;                    // -1 表示还没走到 //@seed
                }
            }
        }
        while (!q.isEmpty()) {
            int[] cur = q.poll();                       //@pop
            for (int[] d : dirs) {                      //@next
                int a = cur[0] + d[0], b = cur[1] + d[1];   //@next
                if (a >= 0 && a < m && b >= 0 && b < n && dist[a][b] == -1) {   //@next
                    dist[a][b] = dist[cur[0]][cur[1]] + 1;  // 第一次走到就是最近的距离 //@next
                    q.offer(new int[]{a, b});           //@next
                }
            }
        }
        return dist;                                    //@done
    }
}
