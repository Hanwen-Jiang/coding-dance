class Solution {
    public int[] searchRange(int[] nums, int target) {
        int start = lowerBound(nums, target);               //@start
        if (start == nums.length || nums[start] != target) {    //@none
            return new int[]{-1, -1};                       //@none
        }
        return new int[]{start, lowerBound(nums, target + 1) - 1};  //@end
    }

    // 第一个 >= x 的下标
    private int lowerBound(int[] nums, int x) {
        int lo = 0, hi = nums.length;                       // 左闭右开 [lo, hi) //@lb
        while (lo < hi) {
            int mid = (lo + hi) / 2;                        //@mid
            if (nums[mid] < x) {                            //@right
                lo = mid + 1;                               //@right
            } else {
                hi = mid;                                   //@left
            }
        }
        return lo;                                          //@lbret
    }
}
