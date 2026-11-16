function climbStairs(n: number): number {
    const dp: number[] = new Array(n + 1).fill(0);  //@init
    dp[0] = dp[1] = 1;                              //@init
    for (let i = 2; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];              // 最后一步跨 1 阶或 2 阶 //@step
    }
    return dp[n];                                   //@done
}
