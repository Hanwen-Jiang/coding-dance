function sortColors(nums: number[]): void {
    let p0 = 0, p1 = 0;                         // 下一个 0、下一个 1 该写的位置 //@init
    for (let i = 0; i < nums.length; i++) {     //@read
        const x = nums[i];                      //@read
        nums[i] = 2;                            //@read
        if (x < 2) {                            //@one
            nums[p1++] = 1;                     //@one
        }
        if (x === 0) {                          //@zero
            nums[p0++] = 0;                     //@zero
        }
    }
}
