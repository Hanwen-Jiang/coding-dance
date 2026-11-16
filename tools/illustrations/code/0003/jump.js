var lengthOfLongestSubstring = function(s) {
    const last = new Map();                             //@init
    let left = 0, best = 0;                             //@init
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (last.has(c) && last.get(c) >= left) {       // c 在窗口里出现过 //@jump,grow
            left = last.get(c) + 1;                     //@jump
        }
        last.set(c, i);                                 //@jump,grow
        best = Math.max(best, i - left + 1);            //@jump,grow
    }
    return best;                                        //@done
};
