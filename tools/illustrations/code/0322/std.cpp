class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        int INF = amount + 1;                       // 最多用 amount 枚，amount + 1 就相当于凑不出 //@init
        vector<int> dp(amount + 1, INF);            // dp[i]：凑出 i 最少几枚 //@init
        dp[0] = 0;                                  //@init
        for (int i = 1; i <= amount; i++) {
            for (int c : coins) {
                if (c <= i && dp[i - c] + 1 < dp[i]) {  //@try
                    dp[i] = dp[i - c] + 1;          // 最后一枚用 c //@try
                }
            }
        }
        return dp[amount] != INF ? dp[amount] : -1; //@done
    }
};
