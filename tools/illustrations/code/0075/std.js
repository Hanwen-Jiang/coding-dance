var sortColors = function(nums) {
    let lo = 0, i = 0, hi = nums.length - 1;   // [0,lo) 是 0，[lo,i) 是 1，(hi,end] 是 2 //@init
    while (i <= hi) {                           //@loop
        if (nums[i] === 0) {                    //@zero
            [nums[lo], nums[i]] = [nums[i], nums[lo]];  //@zero
            lo++;                               //@zero
            i++;                                //@zero
        } else if (nums[i] === 2) {             //@two
            [nums[i], nums[hi]] = [nums[hi], nums[i]];  //@two
            hi--;                               // 换过来的数还没看过，i 不动 //@two
        } else {                                //@one
            i++;                                //@one
        }
    }
};
