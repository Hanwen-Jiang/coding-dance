class Solution {
    public int maxSubArray(int[] nums) {
        int cur = nums[0], best = nums[0];      //@init
        for (int i = 1; i < nums.length; i++) {
            cur = Math.max(nums[i], cur + nums[i]); // 接上前面，或者重新开始 //@step
            best = Math.max(best, cur);         //@step
        }
        return best;                            //@done
    }
}
