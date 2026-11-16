class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        int target = nums.size() - k;               // 第 k 大 = 升序下标 n-k //@init
        int lo = 0, hi = nums.size() - 1;           //@init
        while (true) {                              //@pivot
            int pivot = nums[lo + rand() % (hi - lo + 1)];  //@pivot
            int lt = lo, i = lo, gt = hi;           // [lo,lt) 小于  [lt,i) 等于  (gt,hi] 大于 //@pivot
            while (i <= gt) {                       //@less,more,eq
                if (nums[i] < pivot) {              //@less
                    swap(nums[lt++], nums[i++]);    //@less
                } else if (nums[i] > pivot) {       //@more
                    swap(nums[i], nums[gt--]);      // 换过来的数还没看过，i 不动 //@more
                } else {                            //@eq
                    i++;                            //@eq
                }
            }
            if (target < lt) {                      //@left
                hi = lt - 1;                        // 答案在小于区 //@left
            } else if (target > gt) {               //@right
                lo = gt + 1;                        // 答案在大于区 //@right
            } else {                                //@found
                return pivot;                       // 落在等于区，就是 pivot //@found
            }
        }
    }
};
