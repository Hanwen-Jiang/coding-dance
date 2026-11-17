var knapsack = function(weights, values, capacity) {
    const dp = new Array(capacity + 1).fill(0);     // 一行：一件物品都没有时全是 0 //@init
    weights.forEach((w, i) => {                     //@item
        const v = values[i];                        //@item
        for (let c = capacity; c >= w; c--) {       // 倒着更新：dp[c - w] 还是上一行的值 //@cell
            dp[c] = Math.max(dp[c], dp[c - w] + v); //@cell
        }
    });
    return dp[capacity];                            //@done
};
