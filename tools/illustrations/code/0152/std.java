class Solution {
    public int maxProduct(int[] nums) {
        int hi = nums[0], lo = nums[0], best = nums[0]; // 以当前位置结尾的最大积、最小积 //@init
        for (int i = 1; i < nums.length; i++) {
            int x = nums[i];
            if (x < 0) {                                //@swap
                int t = hi;                             // 乘负数，大小互换 //@swap
                hi = lo;                                //@swap
                lo = t;                                 //@swap
            }
            hi = Math.max(x, hi * x);                   //@update
            lo = Math.min(x, lo * x);                   //@update
            best = Math.max(best, hi);                  //@update
        }
        return best;                                    //@done
    }
}
