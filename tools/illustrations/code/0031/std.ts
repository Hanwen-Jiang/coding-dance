/**
 Do not return anything, modify nums in-place instead.
 */
function nextPermutation(nums: number[]): void {
    let i = nums.length - 2;                        //@init
    while (i >= 0 && nums[i] >= nums[i + 1]) {      // 从右往左找第一个下降 //@findi
        i--;                                        //@findi
    }
    if (i >= 0) {                                   //@found
        let j = nums.length - 1;                    //@findj
        while (nums[j] <= nums[i]) {                // 右边第一个比 nums[i] 大的 //@findj
            j--;                                    //@findj
        }
        [nums[i], nums[j]] = [nums[j], nums[i]];    //@swap
    }
    let l = i + 1, r = nums.length - 1;             // 右段反转成升序 //@rev
    while (l < r) {                                 //@rev
        [nums[l], nums[r]] = [nums[r], nums[l]];    //@rev
        l++;                                        //@rev
        r--;                                        //@rev
    }
}
