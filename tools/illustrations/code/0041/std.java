class Solution {
    public int firstMissingPositive(int[] nums) {
        int n = nums.length;                            //@init
        for (int i = 0; i < n; i++) {
            // nums[i] 应该放在下标 nums[i] - 1，那里还不是它，就换过去
            while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] != nums[i]) {  //@swap,stay
                int j = nums[i] - 1;                    //@swap
                int t = nums[i]; nums[i] = nums[j]; nums[j] = t;    //@swap
            }
        }
        for (int i = 0; i < n; i++) {                   //@scan
            if (nums[i] != i + 1) {                     //@scan
                return i + 1;                           //@scan
            }
        }
        return n + 1;                                   //@done
    }
}
