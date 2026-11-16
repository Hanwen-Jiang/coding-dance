class Solution {
public:
    vector<vector<int>> threeSum(vector<int>& nums) {
        sort(nums.begin(), nums.end());                     //@sort
        set<vector<int>> res;                               // set 本身有序，还能去重 //@sort
        for (int i = 0; i < (int)nums.size(); i++) {
            int x = nums[i];
            if (i > 0 && x == nums[i - 1]) {                //@skip
                continue;                                   //@skip
            }
            unordered_set<int> seen;                        //@fix
            for (int j = i + 1; j < (int)nums.size(); j++) {
                int y = nums[j];
                if (seen.count(-x - y)) {                   //@found,miss
                    res.insert({x, -x - y, y});             //@found
                }
                seen.insert(y);                             //@miss
            }
        }
        return vector<vector<int>>(res.begin(), res.end()); //@done
    }
};
