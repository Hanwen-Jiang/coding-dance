var moveZeroes = function(nums) {
    let j = 0;                                  // 下一个非零数放的位置 //@init
    for (let i = 0; i < nums.length; i++) {     //@scan
        if (nums[i] !== 0) {                    //@swap
            [nums[i], nums[j]] = [nums[j], nums[i]];    //@swap
            j++;                                //@swap
        }
    }
};
