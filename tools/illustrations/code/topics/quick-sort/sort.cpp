class Solution {
    // 把 nums[l..r] 排好
    void quick(vector<int>& nums, int l, int r) {
        if (l >= r) {                           // 只剩 0 或 1 个数 //@base
            return;                             //@base
        }
        int pivot = nums[l + (r - l) / 2];      // 取中间的数当基准 //@pivot
        int i = l - 1, j = r + 1;               //@pivot
        while (i < j) {
            do {                                //@scan
                i++;                            // 左边找一个 >= pivot 的 //@scan
            } while (nums[i] < pivot);          //@scan
            do {                                //@scan
                j--;                            // 右边找一个 <= pivot 的 //@scan
            } while (nums[j] > pivot);          //@scan
            if (i < j) {                        //@swap
                swap(nums[i], nums[j]);         // 交换以后两边都对了 //@swap
            }
        }
        quick(nums, l, j);                      // [l, j] 都 <= pivot //@recur
        quick(nums, j + 1, r);                  // [j+1, r] 都 >= pivot //@recur
    }

public:
    vector<int> sortArray(vector<int>& nums) {
        quick(nums, 0, (int)nums.size() - 1);   //@start
        return nums;                            //@done
    }
};
