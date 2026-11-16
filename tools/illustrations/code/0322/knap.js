var coinChange = function(coins, amount) {
    const dp = new Array(amount + 1).fill(Infinity);    //@init
    dp[0] = 0;                                  //@init
    for (const c of coins) {                    //@coin
        for (let i = c; i <= amount; i++) {     // 正序：同一种硬币可以用很多枚
            dp[i] = Math.min(dp[i], dp[i - c] + 1); //@upd
        }
    }
    return dp[amount] < Infinity ? dp[amount] : -1; //@done
};
