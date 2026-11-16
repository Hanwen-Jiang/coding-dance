var firstUniqChar = function(s) {
    const cnt = new Map();                          // 字符 -> 出现次数 //@init
    for (const ch of s) {                           //@count
        cnt.set(ch, (cnt.get(ch) || 0) + 1);        // 没见过的当作 0 //@count
    }
    for (let i = 0; i < s.length; i++) {            // 再按原来的顺序找 //@find
        if (cnt.get(s[i]) === 1) {                  //@find
            return i;                               //@hit
        }
    }
    return -1;                                      //@miss
};
