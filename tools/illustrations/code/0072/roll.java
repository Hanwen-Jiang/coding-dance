class Solution {
    public int minDistance(String word1, String word2) {
        int m = word1.length(), n = word2.length();
        int[] dp = new int[n + 1];
        for (int j = 0; j <= n; j++) dp[j] = j;         // 第 0 行：空串变成 word2[:j] 要插入 j 次 //@init
        for (int i = 1; i <= m; i++) {
            int leftup = dp[0];                         // 先存下左上角 //@row
            dp[0] = i;                                  // 第 0 列是 i（删光） //@row
            for (int j = 1; j <= n; j++) {
                int up = dp[j];                         // 还没更新，是上一行的值 //@same,diff
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) {   //@same,diff
                    dp[j] = leftup;                     // 最后一个字符相同，不用动 //@same
                } else {
                    dp[j] = 1 + Math.min(up, Math.min(dp[j - 1], leftup));  // 删除、插入、替换 //@diff
                }
                leftup = up;                            // 下一格的左上角，就是这一格的上面 //@same,diff
            }
        }
        return dp[n];                                   //@done
    }
}
