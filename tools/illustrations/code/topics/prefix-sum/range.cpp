class NumArray {
    vector<int> pre;                            // pre[i] 是前 i 个数的和

public:
    NumArray(const vector<int>& nums) {
        pre.assign(nums.size() + 1, 0);         //@init
        for (int i = 0; i < (int)nums.size(); i++) {    //@build
            pre[i + 1] = pre[i] + nums[i];      //@build
        }
    }

    int sumRange(int left, int right) {
        return pre[right + 1] - pre[left];      // 两个前缀和相减 //@query
    }
};
