class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;       // 闭区间 [lo, hi] 是还没排除的范围 //@init
        while (lo <= hi) {                      // 区间不空就继续 //@loop
            int mid = lo + (hi - lo) / 2;       // 不写 (lo + hi) / 2，防止溢出 //@mid
            if (nums[mid] == target) {          //@hit
                return mid;                     //@hit
            }
            if (nums[mid] < target) {           //@right
                lo = mid + 1;                   // mid 和它左边都太小 //@right
            } else {                            //@left
                hi = mid - 1;                   // mid 和它右边都太大 //@left
            }
        }
        return -1;                              //@miss
    }
}
