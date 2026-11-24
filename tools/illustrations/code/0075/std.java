class Solution {
    public void sortColors(int[] nums) {
        int lo = 0, i = 0, hi = nums.length - 1;   // [0,lo) 是 0，[lo,i) 是 1，(hi,end] 是 2 //@init
        while (i <= hi) {                           //@loop
            if (nums[i] == 0) {                     //@chk0
                int t = nums[lo]; nums[lo] = nums[i]; nums[i] = t;  //@swap0
                lo++;                               //@adv0
                i++;                                //@adv0
            } else if (nums[i] == 2) {              //@chk2
                int t = nums[i]; nums[i] = nums[hi]; nums[hi] = t;  //@swap2
                hi--;                               // 换过来的数还没看过，i 不动 //@adv2
            } else {                                //@one
                i++;                                //@one
            }
        }
    }
}
