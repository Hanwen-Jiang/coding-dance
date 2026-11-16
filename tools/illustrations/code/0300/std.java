class Solution {
    public int lengthOfLIS(int[] nums) {
        int n = nums.length;
        int[] dp = new int[n];                          // dp[i]：以 nums[i] 结尾的 LIS 长度 //@init
        Arrays.fill(dp, 1);                             //@init
        int best = 0;
        for (int i = 0; i < n; i++) {                   //@each
            for (int j = 0; j < i; j++) {               //@each
                if (nums[j] < nums[i]) {                //@each
                    dp[i] = Math.max(dp[i], dp[j] + 1); // 接在 nums[j] 后面 //@each
                }
            }
            best = Math.max(best, dp[i]);
        }
        return best;                                    //@done
    }
}
