var longestConsecutive = function(nums) {
    const lens = new Map();                         //@init
    let best = 0;                                   //@init
    for (const x of nums) {
        if (!lens.has(x)) {                         //@dup
            const l = lens.get(x - 1) || 0, r = lens.get(x + 1) || 0;   //@join
            const len = l + r + 1;                  //@join
            lens.set(x, len);                       //@join
            lens.set(x - l, len);                   // 只更新新段的两个端点 //@join
            lens.set(x + r, len);                   //@join
            best = Math.max(best, len);             //@join
        }
    }
    return best;                                    //@done
};
