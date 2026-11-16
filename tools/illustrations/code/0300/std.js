var lengthOfLIS = function(nums) {
    const dp = new Array(nums.length).fill(1);      // dp[i]：以 nums[i] 结尾的 LIS 长度 //@init
    for (let i = 0; i < nums.length; i++) {         //@each
        for (let j = 0; j < i; j++) {               //@each
            if (nums[j] < nums[i]) {                //@each
                dp[i] = Math.max(dp[i], dp[j] + 1); // 接在 nums[j] 后面 //@each
            }
        }
    }
    return Math.max(...dp);                         //@done
};
