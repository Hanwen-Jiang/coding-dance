class Solution {
    public int knapsack(int[] weights, int[] values, int capacity) {
        int n = weights.length;
        int[][] dp = new int[n + 1][capacity + 1];      // 边界：dp[0][c] = 0，没有物品就没有价值 //@init
        for (int i = 1; i <= n; i++) {
            int w = weights[i - 1], v = values[i - 1];
            for (int c = 0; c <= capacity; c++) {
                dp[i][c] = dp[i - 1][c];                // 不选第 i 件 //@skip
                if (c >= w) {                           // 装得下才能选 //@take
                    dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - w] + v);   // 选：让出 w 的容量，价值多 v //@take
                }
            }
        }
        return dp[n][capacity];                         //@done
    }
}
