class Solution {
    public int uniquePaths(int m, int n) {
        int[] dp = new int[n];                          // 第 0 行：全是 1 //@init
        Arrays.fill(dp, 1);                             //@init
        for (int i = 1; i < m; i++) {                   // dp[0] 是第 0 列，永远是 1，不用改 //@row
            for (int j = 1; j < n; j++) {
                dp[j] += dp[j - 1];                     // 原来的 dp[j] 是上面，dp[j-1] 是刚算好的左边 //@cell
            }
        }
        return dp[n - 1];                               //@done
    }
}