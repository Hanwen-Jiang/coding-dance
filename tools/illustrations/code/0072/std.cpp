class Solution {
public:
    int minDistance(string word1, string word2) {
        int m = word1.size(), n = word2.size();         //@init
        vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));   //@init
        for (int i = 0; i <= m; i++) {                  //@init
            dp[i][0] = i;                               // 全删掉 //@init
        }
        for (int j = 0; j <= n; j++) {                  //@init
            dp[0][j] = j;                               // 全插入 //@init
        }
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (word1[i - 1] == word2[j - 1]) {     //@same,diff
                    dp[i][j] = dp[i - 1][j - 1];        // 最后一个字符不用动 //@same
                } else {                                //@diff
                    dp[i][j] = 1 + min({dp[i - 1][j],       // 删除 //@diff
                                        dp[i][j - 1],       // 插入 //@diff
                                        dp[i - 1][j - 1]}); // 替换 //@diff
                }
            }
        }
        return dp[m][n];                                //@done
    }
};
