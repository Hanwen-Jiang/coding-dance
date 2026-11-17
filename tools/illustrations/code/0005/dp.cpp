class Solution {
public:
    string longestPalindrome(string s) {
        int n = s.size();                                   //@init
        vector<vector<bool>> dp(n, vector<bool>(n, false)); // dp[l][r]：s[l..r] 是不是回文 //@init
        int start = 0, size = 1;                            //@init
        for (int len = 1; len <= n; len++) {                // 按长度从短到长填表
            for (int l = 0; l + len - 1 < n; l++) {
                int r = l + len - 1;                        //@fill
                if (s[l] == s[r] && (len <= 2 || dp[l + 1][r - 1])) {  //@fill
                    dp[l][r] = true;                        //@fill
                    if (len > size) {                       //@fill,update
                        start = l;                          //@update
                        size = len;                         //@update
                    }
                }
            }
        }
        return s.substr(start, size);                       //@done
    }
};
