var longestValidParentheses = function(s) {
    const scan = (s, opener) => {
        let best = 0, l = 0, r = 0;                 //@fwd,back
        for (const c of s) {
            if (c === opener) l++;                  //@count
            else r++;                               //@count
            if (l === r) {                          //@eq
                best = Math.max(best, 2 * r);       //@eq
            } else if (r > l) {                     //@reset
                l = r = 0;                          //@reset
            }
        }
        return best;
    };
    return Math.max(scan(s, "("), scan([...s].reverse().join(""), ")"));   // 反过来扫描时把 ) 当成开括号 //@fwd,back,done
};
