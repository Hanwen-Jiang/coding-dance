class Solution {
    public int climbStairs(int n) {
        int[] dp = new int[n + 1];                  //@init
        dp[0] = dp[1] = 1;                          //@init
        for (int i = 2; i <= n; i++) {
            dp[i] = dp[i - 1] + dp[i - 2];          // 最后一步跨 1 阶或 2 阶 //@step
        }
        return dp[n];                               //@done
    }
}
