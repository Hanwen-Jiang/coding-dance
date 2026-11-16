class Solution {
public:
    int longestCommonSubsequence(string text1, string text2) {
        int m = text1.size(), n = text2.size();         //@init
        vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));   //@init
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (text1[i - 1] == text2[j - 1]) {     //@same,diff
                    dp[i][j] = dp[i - 1][j - 1] + 1;    // 一起算进去 //@same
                } else {                                //@diff
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);     // 扔掉一边的最后一个 //@diff
                }
            }
        }
        return dp[m][n];                                //@done
    }
};
