class Solution {
    public int findMin(int[] nums) {
        int lo = 0, hi = nums.length - 1;               //@init
        while (lo < hi) {                               //@front,back
            int mid = (lo + hi) / 2;                    //@front,back
            if (nums[mid] > nums[hi]) {                 // mid 在前一段，最小值在右边 //@front
                lo = mid + 1;                           //@front
            } else {                                    // mid 在后一段，可能就是最小值 //@back
                hi = mid;                               //@back
            }
        }
        return nums[lo];                                //@done
    }
}
