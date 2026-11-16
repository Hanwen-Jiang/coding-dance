class Solution {
    public boolean wordBreak(String s, List<String> wordDict) {
        Set<String> words = new HashSet<>(wordDict);    //@init
        int n = s.length();                             //@init
        boolean[] dp = new boolean[n + 1];              // dp[i]：前 i 个字符能不能拆 //@init
        dp[0] = true;                                   //@init
        for (int i = 1; i <= n; i++) {                  //@try
            for (int j = 0; j < i; j++) {               //@try
                if (dp[j] && words.contains(s.substring(j, i))) {   // 前 j 个能拆，s[j:i] 又是一个词 //@try
                    dp[i] = true;                       //@hit
                    break;                              //@hit
                }
            }
        }
        return dp[n];                                   //@done
    }
}
