class Solution {
    // 第一个 >= x 的位置，没有就是 nums.size()
    int lowerBound(vector<int>& nums, int x) {
        int lo = 0, hi = nums.size();           // 左闭右开 [lo, hi) //@init
        while (lo < hi) {                       //@loop
            int mid = lo + (hi - lo) / 2;       //@mid
            if (nums[mid] < x) {                //@right
                lo = mid + 1;                   // mid 太小，一定不是答案 //@right
            } else {                            //@left
                hi = mid;                       // mid 可能就是答案，留在区间里 //@left
            }
        }
        return lo;                              //@ret
    }

public:
    int countTarget(vector<int>& scores, int target) {
        int left = lowerBound(scores, target);          // target 第一次出现的位置 //@first
        int right = lowerBound(scores, target + 1);     // 第一个比 target 大的位置 //@second
        return right - left;                            //@done
    }
};
