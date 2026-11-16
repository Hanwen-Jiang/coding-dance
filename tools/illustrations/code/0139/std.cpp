class Solution {
public:
    bool wordBreak(string s, vector<string>& wordDict) {
        unordered_set<string> words(wordDict.begin(), wordDict.end());  //@init
        int n = s.size();                               //@init
        vector<bool> dp(n + 1, false);                  // dp[i]：前 i 个字符能不能拆 //@init
        dp[0] = true;                                   //@init
        for (int i = 1; i <= n; i++) {                  //@try
            for (int j = 0; j < i; j++) {               //@try
                if (dp[j] && words.count(s.substr(j, i - j))) {     // 前 j 个能拆，s[j:i] 又是一个词 //@try
                    dp[i] = true;                       //@hit
                    break;                              //@hit
                }
            }
        }
        return dp[n];                                   //@done
    }
};
