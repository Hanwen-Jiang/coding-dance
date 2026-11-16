class Solution {
    public void moveZeroes(int[] nums) {
        int j = 0;                                  // 下一个非零数放的位置 //@init
        for (int i = 0; i < nums.length; i++) {     //@scan
            if (nums[i] != 0) {                     //@swap
                int t = nums[i];                    //@swap
                nums[i] = nums[j];                  //@swap
                nums[j] = t;                        //@swap
                j++;                                //@swap
            }
        }
    }
}
