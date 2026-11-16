var searchInsert = function(nums, target) {
    let lo = 0, hi = nums.length;                   // 左闭右开 [lo, hi) //@init
    while (lo < hi) {                               //@small,big
        const mid = (lo + hi) >> 1;                 //@small,big
        if (nums[mid] < target) {                   //@small
            lo = mid + 1;                           // mid 及左边都太小 //@small
        } else {                                    //@big
            hi = mid;                               // mid 可能就是答案 //@big
        }
    }
    return lo;                                      //@done
};
