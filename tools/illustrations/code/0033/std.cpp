class Solution {
public:
    int search(vector<int>& nums, int target) {
        int lo = 0, hi = nums.size() - 1;                       //@init
        while (lo <= hi) {
            int mid = (lo + hi) / 2;                            //@found,left,right
            if (nums[mid] == target) {                          //@found
                return mid;                                     //@found
            }
            if (nums[lo] <= nums[mid]) {                        // 左半有序 //@left
                if (nums[lo] <= target && target < nums[mid]) { //@left
                    hi = mid - 1;                               //@left
                } else {                                        //@left
                    lo = mid + 1;                               //@left
                }
            } else {                                            // 右半有序 //@right
                if (nums[mid] < target && target <= nums[hi]) { //@right
                    lo = mid + 1;                               //@right
                } else {                                        //@right
                    hi = mid - 1;                               //@right
                }
            }
        }
        return -1;                                              //@miss
    }
};
