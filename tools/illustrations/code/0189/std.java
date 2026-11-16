class Solution {
    public void rotate(int[] nums, int k) {
        int n = nums.length;                    //@init
        k %= n;                                 //@init
        reverse(nums, 0, n - 1);                // 整体翻转 //@all
        reverse(nums, 0, k - 1);                // 翻转前 k 个 //@front
        reverse(nums, k, n - 1);                // 翻转剩下的 //@back
    }

    private void reverse(int[] nums, int i, int j) {
        while (i < j) {
            int t = nums[i];                    //@swap
            nums[i] = nums[j];                  //@swap
            nums[j] = t;                        //@swap
            i++;                                //@swap
            j--;                                //@swap
        }
    }
}
