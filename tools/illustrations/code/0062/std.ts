function uniquePaths(m: number, n: number): number {
    const dp: number[][] = Array.from({ length: m }, () => new Array(n).fill(1));  // 第一行、第一列都只有 1 种走法 //@init
    for (let i = 1; i < m; i++) {
        for (let j = 1; j < n; j++) {
            dp[i][j] = dp[i - 1][j] + dp[i][j - 1];     // 从上面来 + 从左边来 //@cell
        }
    }
    return dp[m - 1][n - 1];                    //@done
}
