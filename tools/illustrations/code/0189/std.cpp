class Solution {
public:
    void rotate(vector<int>& nums, int k) {
        auto reverse = [&](int i, int j) {
            while (i < j) {
                swap(nums[i], nums[j]);         //@swap
                i++;                            //@swap
                j--;                            //@swap
            }
        };
        int n = nums.size();                    //@init
        k %= n;                                 //@init
        reverse(0, n - 1);                      // 整体翻转 //@all
        reverse(0, k - 1);                      // 翻转前 k 个 //@front
        reverse(k, n - 1);                      // 翻转剩下的 //@back
    }
};
