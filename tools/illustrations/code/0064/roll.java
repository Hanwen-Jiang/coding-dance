class Solution {
    public int minPathSum(int[][] grid) {
        int n = grid[0].length;
        int[] dp = new int[n];
        Arrays.fill(dp, Integer.MAX_VALUE);             // 第 -1 行：越界，走不过来，全是 ∞ //@init
        dp[0] = 0;                                      // 只有起点的「上面」当成 0 //@init
        for (int[] row : grid) {                        //@row
            for (int j = 0; j < n; j++) {
                int left = j > 0 ? dp[j - 1] : Integer.MAX_VALUE;   // j = 0 时左边越界，取 ∞ //@cell
                dp[j] = Math.min(dp[j], left) + row[j];     // 上面是 dp[j]，左边是 dp[j-1] //@cell
            }
        }
        return dp[n - 1];                               //@done
    }
}