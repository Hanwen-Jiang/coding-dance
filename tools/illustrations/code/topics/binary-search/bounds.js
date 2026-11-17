var countTarget = function(scores, target) {
    // 第一个 >= x 的位置，没有就是 scores.length
    const lowerBound = (x) => {
        let lo = 0, hi = scores.length;     // 左闭右开 [lo, hi) //@init
        while (lo < hi) {                   //@loop
            const mid = (lo + hi) >> 1;     //@mid
            if (scores[mid] < x) {          //@right
                lo = mid + 1;               // mid 太小，一定不是答案 //@right
            } else {                        //@left
                hi = mid;                   // mid 可能就是答案，留在区间里 //@left
            }
        }
        return lo;                          //@ret
    };
    const left = lowerBound(target);        // target 第一次出现的位置 //@first
    const right = lowerBound(target + 1);   // 第一个比 target 大的位置 //@second
    return right - left;                    //@done
};
