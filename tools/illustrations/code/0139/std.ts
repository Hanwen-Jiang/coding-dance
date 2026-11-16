function wordBreak(s: string, wordDict: string[]): boolean {
    const words = new Set(wordDict);                //@init
    const n = s.length;                             //@init
    const dp: boolean[] = new Array(n + 1).fill(false); // dp[i]：前 i 个字符能不能拆 //@init
    dp[0] = true;                                   //@init
    for (let i = 1; i <= n; i++) {                  //@try
        for (let j = 0; j < i; j++) {               //@try
            if (dp[j] && words.has(s.slice(j, i))) {    // 前 j 个能拆，s[j:i] 又是一个词 //@try
                dp[i] = true;                       //@hit
                break;                              //@hit
            }
        }
    }
    return dp[n];                                   //@done
}
