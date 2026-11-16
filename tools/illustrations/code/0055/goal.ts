function canJump(nums: number[]): boolean {
    let goal = nums.length - 1;                     //@init
    for (let i = nums.length - 2; i >= 0; i--) {
        if (i + nums[i] >= goal) {                  //@move,stay
            goal = i;                               //@move
        }
    }
    return goal === 0;                              //@done
}
