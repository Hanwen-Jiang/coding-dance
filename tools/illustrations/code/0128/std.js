var longestConsecutive = function(nums) {
    const s = new Set(nums);                    //@init
    let best = 0;                               //@init
    for (const x of s) {                        // 遍历集合，不是遍历 nums
        if (s.has(x - 1)) {                     //@skip
            continue;                           // 不是起点，跳过 //@skip
        }
        let y = x;                              //@start
        while (s.has(y + 1)) {                  //@count
            y++;                                //@count
        }
        best = Math.max(best, y - x + 1);       //@best
    }
    return best;                                //@done
};
