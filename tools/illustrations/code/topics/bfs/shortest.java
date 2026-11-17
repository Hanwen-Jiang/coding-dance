class Solution {
    public int nearestExit(char[][] maze, int[] entrance) {
        int m = maze.length, n = maze[0].length;
        int[][] dirs = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        Deque<int[]> q = new ArrayDeque<>();                    // {行, 列, 走了几步} //@init
        q.offer(new int[]{entrance[0], entrance[1], 0});        //@init
        maze[entrance[0]][entrance[1]] = '+';                   // 走过的格子标成墙，不再走 //@init
        while (!q.isEmpty()) {
            int[] cur = q.poll();                               //@pop
            for (int[] dir : dirs) {                            //@next
                int a = cur[0] + dir[0], b = cur[1] + dir[1];   //@next
                if (a >= 0 && a < m && b >= 0 && b < n && maze[a][b] == '.') {  //@next
                    if (a == 0 || a == m - 1 || b == 0 || b == n - 1) {     // 到了边上：就是出口 //@exit
                        return cur[2] + 1;                      //@exit
                    }
                    maze[a][b] = '+';                           // 入队时就标记 //@push
                    q.offer(new int[]{a, b, cur[2] + 1});       //@push
                }
            }
        }
        return -1;                                              //@done
    }
}
