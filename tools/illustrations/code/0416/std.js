var canPartition = function(nums) {
    const total = nums.reduce((s, x) => s + x, 0);  //@init,odd
    if (total % 2) {                            //@odd
        return false;                           //@odd
    }
    const target = total / 2;                   //@init
    const dp = new Array(target + 1).fill(false);   // dp[j]：能不能凑出和 j //@init
    dp[0] = true;                               //@init
    for (const x of nums) {                     //@add
        for (let j = target; j >= x; j--) {     // 倒序：每个数只用一次 //@add
            dp[j] = dp[j] || dp[j - x];         //@add
        }
    }
    return dp[target];                          //@done
};
