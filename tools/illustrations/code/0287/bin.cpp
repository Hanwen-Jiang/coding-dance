class Solution {
public:
    int findDuplicate(vector<int>& nums) {
        int lo = 0, hi = nums.size();                   // 在 [lo, hi) 里找第一个「≤ x 的数超过 x 个」的 x //@init
        while (lo < hi) {                               //@left,right
            int mid = (lo + hi) / 2;                    //@left,right
            int cnt = 0;                                //@left,right
            for (int v : nums) {                        //@left,right
                if (v <= mid) cnt++;                    //@left,right
            }
            if (cnt > mid) {                            // 重复的数 ≤ mid //@left
                hi = mid;                               //@left
            } else {                                    //@right
                lo = mid + 1;                           //@right
            }
        }
        return lo;                                      //@done
    }
};
