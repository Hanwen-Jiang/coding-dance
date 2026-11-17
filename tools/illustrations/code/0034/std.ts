function searchRange(nums: number[], target: number): number[] {
    // 第一个 >= x 的下标
    const lowerBound = (x: number): number => {
        let lo = 0, hi = nums.length;               // 左闭右开 [lo, hi) //@lb
        while (lo < hi) {
            const mid = (lo + hi) >> 1;             //@mid
            if (nums[mid] < x) {                    //@right
                lo = mid + 1;                       //@right
            } else {
                hi = mid;                           //@left
            }
        }
        return lo;                                  //@lbret
    };
    const start = lowerBound(target);               //@start
    if (start === nums.length || nums[start] !== target) {  //@none
        return [-1, -1];                            //@none
    }
    return [start, lowerBound(target + 1) - 1];     //@end
}
