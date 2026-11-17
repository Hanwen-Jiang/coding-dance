class Solution {
    public int minCostClimbingStairs(int[] cost) {
        int a = 0, b = 0;                   // dp[0]、dp[1] //@init
        for (int i = 2; i <= cost.length; i++) {    //@step
            int c = Math.min(b + cost[i - 1], a + cost[i - 2]);    // dp[i] //@step
            a = b;                          // 两个变量一起往后挪 //@step
            b = c;                          //@step
        }
        return b;                           //@done
    }
}
