function maxProduct(nums: number[]): number {
    let hi = nums[0], lo = nums[0], best = nums[0]; // 以当前位置结尾的最大积、最小积 //@init
    for (let i = 1; i < nums.length; i++) {
        const x = nums[i];
        if (x < 0) {                                //@swap
            [hi, lo] = [lo, hi];                    // 乘负数，大小互换 //@swap
        }
        hi = Math.max(x, hi * x);                   //@update
        lo = Math.min(x, lo * x);                   //@update
        best = Math.max(best, hi);                  //@update
    }
    return best;                                    //@done
}
