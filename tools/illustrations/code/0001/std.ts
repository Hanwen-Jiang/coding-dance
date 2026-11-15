function twoSum(nums: number[], target: number): number[] {
    const seen = new Map<number, number>();     // 数值 -> 下标 //@init
    for (let i = 0; i < nums.length; i++) {
        const j = seen.get(target - nums[i]);   // 先查 //@check
        if (j !== undefined) {                  //@check
            return [j, i];                      //@found
        }
        seen.set(nums[i], i);                   // 再存 //@save
    }
    return [];
}
