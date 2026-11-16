var longestPalindrome = function(s) {
    const expand = (l, r) => {
        while (l >= 0 && r < s.length && s[l] === s[r]) {   //@grow,miss
            l--;                                        //@grow
            r++;                                        //@grow
        }
        return [l + 1, r - 1];                          // 退回最后一次成功的位置 //@grow
    };
    let start = 0, end = 0;                             //@init
    for (let i = 0; i < s.length; i++) {
        for (const [l, r] of [expand(i, i), expand(i, i + 1)]) {    // 奇数中心、偶数中心 //@grow,miss
            if (r - l > end - start) {                  //@grow,update
                start = l;                              //@update
                end = r;                                //@update
            }
        }
    }
    return s.slice(start, end + 1);                     //@done
};
