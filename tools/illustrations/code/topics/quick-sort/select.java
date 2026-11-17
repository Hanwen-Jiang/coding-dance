class Solution {
    public int findKthLargest(int[] nums, int k) {
        int target = nums.length - k;           // 第 k 大 = 从小到大排好后下标 n-k 的数 //@init
        int l = 0, r = nums.length - 1;         //@init
        while (l < r) {
            int pivot = nums[l + (r - l) / 2];  //@pivot
            int i = l - 1, j = r + 1;           //@pivot
            while (i < j) {
                do {                            //@scan
                    i++;                        //@scan
                } while (nums[i] < pivot);      //@scan
                do {                            //@scan
                    j--;                        //@scan
                } while (nums[j] > pivot);      //@scan
                if (i < j) {                    //@swap
                    int t = nums[i];            //@swap
                    nums[i] = nums[j];          //@swap
                    nums[j] = t;                //@swap
                }
            }
            if (target <= j) {                  // 答案在左边一段 //@go
                r = j;                          //@go
            } else {                            // 答案在右边一段 //@go
                l = j + 1;                      //@go
            }
        }
        return nums[l];                         //@done
    }
}
