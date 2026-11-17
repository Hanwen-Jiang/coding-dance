class Solution {
    public void sortColors(int[] nums) {
        int lo = 0, i = 0, hi = nums.length - 1;   // [0,lo) 是 0，[lo,i) 是 1，(hi,end] 是 2 //@init
        while (i <= hi) {                           //@loop
            if (nums[i] == 0) {                     //@zero
                swap(nums, lo, i);                  //@zero
                lo++;                               //@zero
                i++;                                //@zero
            } else if (nums[i] == 2) {              //@two
                swap(nums, i, hi);                  //@two
                hi--;                               // 换过来的数还没看过，i 不动 //@two
            } else {                                //@one
                i++;                                //@one
            }
        }
    }

    private void swap(int[] nums, int a, int b) {
        int t = nums[a];
        nums[a] = nums[b];
        nums[b] = t;
    }
}
