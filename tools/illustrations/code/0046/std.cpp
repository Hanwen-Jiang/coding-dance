class Solution {
public:
    vector<vector<int>> permute(vector<int>& nums) {
        vector<vector<int>> res;                        //@init
        vector<int> path;                               //@init
        vector<bool> used(nums.size(), false);          //@init
        function<void()> dfs = [&]() {
            if (path.size() == nums.size()) {           //@collect
                res.push_back(path);                    //@collect
                return;                                 //@collect
            }
            for (int i = 0; i < nums.size(); i++) {
                if (used[i]) {
                    continue;
                }
                used[i] = true;                         //@choose
                path.push_back(nums[i]);                //@choose
                dfs();
                path.pop_back();                        // 撤销选择
                used[i] = false;
            }
        };
        dfs();                                          //@init
        return res;                                     //@done
    }
};
