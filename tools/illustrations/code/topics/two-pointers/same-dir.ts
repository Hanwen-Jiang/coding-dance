function removeDuplicates(nums: number[]): number {
    let slow = 1;                                   // nums[0..slow-1] 是去重后的结果 //@init
    for (let fast = 1; fast < nums.length; fast++) {    // fast 往前扫每一个数 //@scan
        if (nums[fast] !== nums[slow - 1]) {        // 和结果的最后一个不一样：是新数 //@keep
            nums[slow] = nums[fast];                //@keep
            slow++;                                 //@keep
        }
    }
    return slow;                                    //@done
}
