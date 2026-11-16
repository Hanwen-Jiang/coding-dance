class Solution {
public:
    vector<int> searchRange(vector<int>& nums, int target) {
        int start = lowerBound(nums, target);               //@start
        if (start == (int)nums.size() || nums[start] != target) {   //@none
            return {-1, -1};                                //@none
        }
        return {start, lowerBound(nums, target + 1) - 1};   //@end
    }

private:
    // 第一个 >= x 的下标
    int lowerBound(vector<int>& nums, int x) {
        int lo = 0, hi = nums.size();                       // 左闭右开 [lo, hi) //@lb
        while (lo < hi) {
            int mid = (lo + hi) / 2;                        //@mid
            if (nums[mid] < x) {                            //@right
                lo = mid + 1;                               //@right
            } else {
                hi = mid;                                   //@left
            }
        }
        return lo;                                          //@lbret
    }
};
