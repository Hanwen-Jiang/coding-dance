class Solution {
    public int coinChange(int[] coins, int amount) {
        int INF = amount + 1;                       // 最多用 amount 枚，amount + 1 就相当于凑不出 //@init
        int[] dp = new int[amount + 1];             //@init
        Arrays.fill(dp, INF);                       //@init
        dp[0] = 0;                                  //@init
        for (int c : coins) {                       //@coin
            for (int i = c; i <= amount; i++) {     // 正序：同一种硬币可以用很多枚
                dp[i] = Math.min(dp[i], dp[i - c] + 1); //@upd
            }
        }
        return dp[amount] != INF ? dp[amount] : -1; //@done
    }
}
