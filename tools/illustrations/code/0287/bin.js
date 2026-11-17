var findDuplicate = function(nums) {
    let lo = 0, hi = nums.length;                   // 在 [lo, hi) 里找第一个「≤ x 的数超过 x 个」的 x //@init
    while (lo < hi) {                               //@left,right
        const mid = (lo + hi) >> 1;                 //@left,right
        let cnt = 0;                                //@left,right
        for (const v of nums) {                     //@left,right
            if (v <= mid) cnt++;                    //@left,right
        }
        if (cnt > mid) {                            // 重复的数 ≤ mid //@left
            hi = mid;                               //@left
        } else {                                    //@right
            lo = mid + 1;                           //@right
        }
    }
    return lo;                                      //@done
};
