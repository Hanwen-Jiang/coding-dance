var numSquares = function(n) {
    const dp = new Array(n + 1).fill(Infinity);     // dp[i]：和为 i 最少几个平方数 //@init
    dp[0] = 0;                                      //@init
    for (let i = 1; i <= n; i++) {                  //@each
        for (let j = 1; j * j <= i; j++) {          //@each
            dp[i] = Math.min(dp[i], dp[i - j * j] + 1); // 最后一个数取 j² //@each
        }
    }
    return dp[n];                                   //@done
};
