var twoSum = function(nums, target) {
    const seen = new Map();                 // 数值 -> 下标 //@init
    for (let i = 0; i < nums.length; i++) {
        if (seen.has(target - nums[i])) {   // 先查 //@check
            return [seen.get(target - nums[i]), i];     //@found
        }
        seen.set(nums[i], i);               // 再存 //@save
    }
    return [];
};
