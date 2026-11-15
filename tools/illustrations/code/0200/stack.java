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
                Deque<int[]> stack = new ArrayDeque<>();        //@found
                stack.push(new int[]{i, j});                    //@found
                while (!stack.isEmpty()) {
                    int[] cur = stack.pop();                    //@pop
                    for (int[] d : DIRS) {                      //@expand
                        int a = cur[0] + d[0], b = cur[1] + d[1];   //@expand
                        if (a >= 0 && a < m && b >= 0 && b < n && grid[a][b] == '1') {  //@expand
                            grid[a][b] = '0';                   // 入栈时就做记号 //@expand
                            stack.push(new int[]{a, b});        //@expand
                        }
                    }
                }
            }
        }
        return count;                                           //@done
    }
}
