class Solution {
public:
    bool canPartition(vector<int>& nums) {
        int total = accumulate(nums.begin(), nums.end(), 0);    //@init,odd
        if (total % 2) {                            //@odd
            return false;                           //@odd
        }
        int target = total / 2;                     //@init
        vector<bool> dp(target + 1, false);         // dp[j]：能不能凑出和 j //@init
        dp[0] = true;                               //@init
        for (int x : nums) {                        //@add
            for (int j = target; j >= x; j--) {     // 倒序：每个数只用一次 //@add
                dp[j] = dp[j] || dp[j - x];         //@add
            }
        }
        return dp[target];                          //@done
    }
};
