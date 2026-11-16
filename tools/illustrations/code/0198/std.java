class Solution {
    public int rob(int[] nums) {
        int n = nums.length;                    //@init
        int[] dp = new int[n + 1];              // dp[i]：前 i 间房最多偷多少 //@init
        dp[1] = nums[0];                        //@init
        for (int i = 2; i <= n; i++) {
            dp[i] = Math.max(dp[i - 1],                 // 不偷第 i 间 //@step
                             dp[i - 2] + nums[i - 1]);  // 偷第 i 间 //@step
        }
        return dp[n];                           //@done
    }
}
