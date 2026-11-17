var minCostClimbingStairs = function(cost) {
    let a = 0, b = 0;                       // dp[0]、dp[1] //@init
    for (let i = 2; i <= cost.length; i++) {    //@step
        [a, b] = [b, Math.min(b + cost[i - 1], a + cost[i - 2])];  // 新的 b 是 dp[i] //@step
    }
    return b;                               //@done
};
