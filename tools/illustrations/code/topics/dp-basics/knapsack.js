var knapsack = function(weights, values, capacity) {
    const n = weights.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));   // 边界：dp[0][c] = 0，没有物品就没有价值 //@init
    for (let i = 1; i <= n; i++) {
        const w = weights[i - 1], v = values[i - 1];
        for (let c = 0; c <= capacity; c++) {
            dp[i][c] = dp[i - 1][c];                // 不选第 i 件 //@skip
            if (c >= w) {                           // 装得下才能选 //@take
                dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - w] + v);   // 选：让出 w 的容量，价值多 v //@take
            }
        }
    }
    return dp[n][capacity];                         //@done
};
