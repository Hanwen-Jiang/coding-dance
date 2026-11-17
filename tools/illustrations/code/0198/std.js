var rob = function(nums) {
    const n = nums.length;                      //@init
    const dp = new Array(n + 1).fill(0);        // dp[i]：前 i 间房最多偷多少 //@init
    dp[1] = nums[0];                            //@init
    for (let i = 2; i <= n; i++) {
        dp[i] = Math.max(dp[i - 1],                     // 不偷第 i 间 //@step
                         dp[i - 2] + nums[i - 1]);      // 偷第 i 间 //@step
    }
    return dp[n];                               //@done
};
