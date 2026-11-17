class Solution {
    vector<int> tmp;

    // 把 nums[l..r] 排好
    void mergeSort(vector<int>& nums, int l, int r) {
        if (l >= r) {                           //@base
            return;                             //@base
        }
        int mid = l + (r - l) / 2;              //@split
        mergeSort(nums, l, mid);                // 先把两半各自排好 //@split
        mergeSort(nums, mid + 1, r);            //@split
        int i = l, j = mid + 1, k = l;          // 合并两个有序的半段 //@merge
        while (i <= mid && j <= r) {            //@merge
            if (nums[i] <= nums[j]) {           // 相等时先拿左边的：稳定 //@take
                tmp[k++] = nums[i++];           //@take
            } else {                            //@take
                tmp[k++] = nums[j++];           //@take
            }
        }
        while (i <= mid) {                      // 一边用完了，另一边剩下的直接接上 //@rest
            tmp[k++] = nums[i++];               //@rest
        }
        while (j <= r) {                        //@rest
            tmp[k++] = nums[j++];               //@rest
        }
        copy(tmp.begin() + l, tmp.begin() + r + 1, nums.begin() + l);  // 拷回原数组 //@copy
    }

public:
    vector<int> sortArray(vector<int>& nums) {
        tmp.resize(nums.size());
        mergeSort(nums, 0, (int)nums.size() - 1);   //@start
        return nums;                            //@done
    }
};
