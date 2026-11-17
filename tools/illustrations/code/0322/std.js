var coinChange = function(coins, amount) {
    const dp = new Array(amount + 1).fill(Infinity);    // dp[i]：凑出 i 最少几枚 //@init
    dp[0] = 0;                                  //@init
    for (let i = 1; i <= amount; i++) {
        for (const c of coins) {
            if (c <= i && dp[i - c] + 1 < dp[i]) {  //@try
                dp[i] = dp[i - c] + 1;          // 最后一枚用 c //@try
            }
        }
    }
    return dp[amount] !== Infinity ? dp[amount] : -1;   //@done
};
