class NumArray {
    private pre: number[];                              // pre[i] 是前 i 个数的和

    constructor(nums: number[]) {
        this.pre = new Array(nums.length + 1).fill(0);  //@init
        for (let i = 0; i < nums.length; i++) {         //@build
            this.pre[i + 1] = this.pre[i] + nums[i];    //@build
        }
    }

    sumRange(left: number, right: number): number {
        return this.pre[right + 1] - this.pre[left];    // 两个前缀和相减 //@query
    }
}
