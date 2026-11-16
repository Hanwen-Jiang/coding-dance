class Solution {
public:
    int maxProduct(vector<int>& nums) {
        int hi = nums[0], lo = nums[0], best = nums[0]; // 以当前位置结尾的最大积、最小积 //@init
        for (int i = 1; i < nums.size(); i++) {
            int x = nums[i];
            if (x < 0) {                                //@swap
                swap(hi, lo);                           // 乘负数，大小互换 //@swap
            }
            hi = max(x, hi * x);                        //@update
            lo = min(x, lo * x);                        //@update
            best = max(best, hi);                       //@update
        }
        return best;                                    //@done
    }
};
