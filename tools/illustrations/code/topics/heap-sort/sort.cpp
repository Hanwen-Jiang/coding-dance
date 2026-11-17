class Solution {
    // 在 nums[0..n-1] 这个最大堆里让 nums[i] 下沉
    void siftDown(vector<int>& nums, int i, int n) {
        while (true) {
            int big = i, l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && nums[l] > nums[big]) big = l;
            if (r < n && nums[r] > nums[big]) big = r;
            if (big == i) return;
            swap(nums[i], nums[big]);
            i = big;
        }
    }

public:
    vector<int> sortArray(vector<int>& nums) {
        int n = nums.size();
        for (int i = n / 2 - 1; i >= 0; i--) {  // 建最大堆：从最后一个非叶子往前下沉 //@build
            siftDown(nums, i, n);               //@build
        }
        for (int end = n - 1; end > 0; end--) { //@pick
            swap(nums[0], nums[end]);           // 堆顶（最大）换到末尾 //@pick
            siftDown(nums, 0, end);             // 剩下的 end 个数重新调成堆 //@fix
        }
        return nums;                            //@done
    }
};
