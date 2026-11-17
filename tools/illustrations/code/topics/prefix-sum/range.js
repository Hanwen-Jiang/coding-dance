class NumArray {
    constructor(nums) {
        this.pre = new Array(nums.length + 1).fill(0);  // pre[i] 是前 i 个数的和 //@init
        for (let i = 0; i < nums.length; i++) {         //@build
            this.pre[i + 1] = this.pre[i] + nums[i];    //@build
        }
    }

    sumRange(left, right) {
        return this.pre[right + 1] - this.pre[left];    // 两个前缀和相减 //@query
    }
}
