class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        int cur = nums[0], best = nums[0];      //@init
        for (int i = 1; i < nums.size(); i++) {
            cur = max(nums[i], cur + nums[i]);  // 接上前面，或者重新开始 //@step
            best = max(best, cur);              //@step
        }
        return best;                            //@done
    }
};
