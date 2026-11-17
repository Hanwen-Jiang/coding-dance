var maxVowels = function(s, k) {
    const isVowel = (c) => ("aeiou".includes(c) ? 1 : 0);
    let cnt = 0;
    for (let i = 0; i < k; i++) {               // 第一个窗口 //@init
        cnt += isVowel(s[i]);                   //@init
    }
    let best = cnt;                             //@init
    for (let i = k; i < s.length; i++) {        // 窗口右移一格 //@slide
        cnt += isVowel(s[i]) - isVowel(s[i - k]);   // 进来 s[i]，出去 s[i-k] //@slide
        best = Math.max(best, cnt);             //@slide
    }
    return best;                                //@done
};
