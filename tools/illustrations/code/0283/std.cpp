class Solution {
public:
    void moveZeroes(vector<int>& nums) {
        int j = 0;                                  // 下一个非零数放的位置 //@init
        for (int i = 0; i < nums.size(); i++) {     //@scan
            if (nums[i] != 0) {                     //@swap
                swap(nums[i], nums[j]);             //@swap
                j++;                                //@swap
            }
        }
    }
};
