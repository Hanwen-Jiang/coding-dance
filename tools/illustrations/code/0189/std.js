var rotate = function(nums, k) {
    const reverse = (i, j) => {
        while (i < j) {
            [nums[i], nums[j]] = [nums[j], nums[i]];    //@swap
            i++;                                //@swap
            j--;                                //@swap
        }
    };
    const n = nums.length;                      //@init
    k %= n;                                     //@init
    reverse(0, n - 1);                          // 整体翻转 //@all
    reverse(0, k - 1);                          // 翻转前 k 个 //@front
    reverse(k, n - 1);                          // 翻转剩下的 //@back
};
