class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0;                              //@init,odd
        for (int x : nums) total += x;              //@init,odd
        if (total % 2 != 0) {                       //@odd
            return false;                           //@odd
        }
        int target = total / 2;                     //@init
        boolean[] dp = new boolean[target + 1];     // dp[j]：能不能凑出和 j //@init
        dp[0] = true;                               //@init
        for (int x : nums) {                        //@add
            for (int j = target; j >= x; j--) {     // 倒序：每个数只用一次 //@add
                dp[j] = dp[j] || dp[j - x];         //@add
            }
        }
        return dp[target];                          //@done
    }
}
