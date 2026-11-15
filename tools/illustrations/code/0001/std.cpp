class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;               // 数值 -> 下标 //@init
        for (int i = 0; i < (int)nums.size(); i++) {
            auto it = seen.find(target - nums[i]);  // 先查 //@check
            if (it != seen.end()) {                 //@check
                return {it->second, i};             //@found
            }
            seen[nums[i]] = i;                      // 再存 //@save
        }
        return {};
    }
};
