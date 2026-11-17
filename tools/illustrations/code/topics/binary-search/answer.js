var minEatingSpeed = function(piles, h) {
    // 速度为 k 时要吃几小时
    const hours = (k) => {
        let total = 0;
        for (const p of piles) {
            total += Math.ceil(p / k);      //@check
        }
        return total;
    };
    let lo = 1, hi = Math.max(...piles);    // 答案一定在 [lo, hi] 里 //@init
    while (lo < hi) {                       //@loop
        const mid = Math.floor((lo + hi) / 2);  //@mid
        if (hours(mid) <= h) {              // 吃得完：答案是 mid 或更小 //@ok
            hi = mid;                       //@ok
        } else {                            // 吃不完：要更快 //@slow
            lo = mid + 1;                   //@slow
        }
    }
    return lo;                              //@done
};
