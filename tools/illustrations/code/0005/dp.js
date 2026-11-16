var longestPalindrome = function(s) {
    const n = s.length;                                 //@init
    const dp = Array.from({ length: n }, () => new Array(n).fill(false));   // dp[l][r]：s[l..r] 是不是回文 //@init
    let start = 0, size = 1;                            //@init
    for (let len = 1; len <= n; len++) {                // 按长度从短到长填表
        for (let l = 0; l + len - 1 < n; l++) {
            const r = l + len - 1;                      //@fill
            if (s[l] === s[r] && (len <= 2 || dp[l + 1][r - 1])) {  //@fill
                dp[l][r] = true;                        //@fill
                if (len > size) {                       //@fill,update
                    start = l;                          //@update
                    size = len;                         //@update
                }
            }
        }
    }
    return s.slice(start, start + size);                //@done
};
