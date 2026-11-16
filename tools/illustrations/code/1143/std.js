var longestCommonSubsequence = function(text1, text2) {
    const m = text1.length, n = text2.length;       //@init
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));  //@init
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (text1[i - 1] === text2[j - 1]) {    //@same,diff
                dp[i][j] = dp[i - 1][j - 1] + 1;    // 一起算进去 //@same
            } else {                                //@diff
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);    // 扔掉一边的最后一个 //@diff
            }
        }
    }
    return dp[m][n];                                //@done
};
