class Solution {
public:
    int lengthOfLIS(vector<int>& nums) {
        int n = nums.size();
        vector<int> dp(n, 1);                           // dp[i]：以 nums[i] 结尾的 LIS 长度 //@init
        for (int i = 0; i < n; i++) {                   //@each
            for (int j = 0; j < i; j++) {               //@each
                if (nums[j] < nums[i]) {                //@each
                    dp[i] = max(dp[i], dp[j] + 1);      // 接在 nums[j] 后面 //@each
                }
            }
        }
        return *max_element(dp.begin(), dp.end());      //@done
    }
};
