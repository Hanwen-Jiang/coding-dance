var minPathSum = function(grid) {
    const n = grid[0].length;
    const dp = new Array(n).fill(Infinity);         // 第 -1 行：越界，走不过来，全是 ∞ //@init
    dp[0] = 0;                                      // 只有起点的「上面」当成 0 //@init
    for (const row of grid) {                       //@row
        for (let j = 0; j < n; j++) {
            const left = j > 0 ? dp[j - 1] : Infinity;  // j = 0 时左边越界，取 ∞ //@cell
            dp[j] = Math.min(dp[j], left) + row[j]; // 上面是 dp[j]，左边是 dp[j-1] //@cell
        }
    }
    return dp[n - 1];                               //@done
};