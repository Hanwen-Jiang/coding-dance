class Solution {
public:
    void nextPermutation(vector<int>& nums) {
        int i = (int)nums.size() - 2;                   //@init
        while (i >= 0 && nums[i] >= nums[i + 1]) {      // 从右往左找第一个下降 //@findi
            i--;                                        //@findi
        }
        if (i >= 0) {                                   //@found
            int j = (int)nums.size() - 1;               //@findj
            while (nums[j] <= nums[i]) {                // 右边第一个比 nums[i] 大的 //@findj
                j--;                                    //@findj
            }
            swap(nums[i], nums[j]);                     //@swap
        }
        int l = i + 1, r = (int)nums.size() - 1;        // 右段反转成升序 //@rev
        while (l < r) {                                 //@rev
            swap(nums[l++], nums[r--]);                 //@rev
        }
    }
};
