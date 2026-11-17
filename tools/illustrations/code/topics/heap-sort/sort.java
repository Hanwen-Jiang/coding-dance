class Solution {
    public int[] sortArray(int[] nums) {
        int n = nums.length;
        for (int i = n / 2 - 1; i >= 0; i--) {  // 建最大堆：从最后一个非叶子往前下沉 //@build
            siftDown(nums, i, n);               //@build
        }
        for (int end = n - 1; end > 0; end--) { //@pick
            int t = nums[0];                    // 堆顶（最大）换到末尾 //@pick
            nums[0] = nums[end];                //@pick
            nums[end] = t;                      //@pick
            siftDown(nums, 0, end);             // 剩下的 end 个数重新调成堆 //@fix
        }
        return nums;                            //@done
    }

    // 在 nums[0..n-1] 这个最大堆里让 nums[i] 下沉
    private void siftDown(int[] nums, int i, int n) {
        while (true) {
            int big = i, l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && nums[l] > nums[big]) big = l;
            if (r < n && nums[r] > nums[big]) big = r;
            if (big == i) return;
            int t = nums[i];
            nums[i] = nums[big];
            nums[big] = t;
            i = big;
        }
    }
}
