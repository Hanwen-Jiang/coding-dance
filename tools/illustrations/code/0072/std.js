var minDistance = function(word1, word2) {
    const m = word1.length, n = word2.length;       //@init
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));  //@init
    for (let i = 0; i <= m; i++) {                  //@init
        dp[i][0] = i;                               // 全删掉 //@init
    }
    for (let j = 0; j <= n; j++) {                  //@init
        dp[0][j] = j;                               // 全插入 //@init
    }
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (word1[i - 1] === word2[j - 1]) {    //@same,diff
                dp[i][j] = dp[i - 1][j - 1];        // 最后一个字符不用动 //@same
            } else {                                //@diff
                dp[i][j] = 1 + Math.min(dp[i - 1][j],   // 删除 //@diff
                                        dp[i][j - 1],   // 插入 //@diff
                                        dp[i - 1][j - 1]);  // 替换 //@diff
            }
        }
    }
    return dp[m][n];                                //@done
};
