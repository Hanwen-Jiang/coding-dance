class NumArray {
    private final int[] pre;                    // pre[i] 是前 i 个数的和

    public NumArray(int[] nums) {
        pre = new int[nums.length + 1];         //@init
        for (int i = 0; i < nums.length; i++) { //@build
            pre[i + 1] = pre[i] + nums[i];      //@build
        }
    }

    public int sumRange(int left, int right) {
        return pre[right + 1] - pre[left];      // 两个前缀和相减 //@query
    }
}
