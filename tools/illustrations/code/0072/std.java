class Solution {
    public int minDistance(String word1, String word2) {
        int m = word1.length(), n = word2.length();     //@init
        int[][] dp = new int[m + 1][n + 1];             //@init
        for (int i = 0; i <= m; i++) {                  //@init
            dp[i][0] = i;                               // 全删掉 //@init
        }
        for (int j = 0; j <= n; j++) {                  //@init
            dp[0][j] = j;                               // 全插入 //@init
        }
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) {   //@same,diff
                    dp[i][j] = dp[i - 1][j - 1];        // 最后一个字符不用动 //@same
                } else {                                //@diff
                    dp[i][j] = 1 + Math.min(dp[i - 1][j],       // 删除 //@diff
                                   Math.min(dp[i][j - 1],       // 插入 //@diff
                                            dp[i - 1][j - 1])); // 替换 //@diff
                }
            }
        }
        return dp[m][n];                                //@done
    }
}
