class Solution {
public:
    vector<vector<int>> subsets(vector<int>& nums) {
        vector<vector<int>> res;                            //@init
        vector<int> path;                                   //@init
        function<void(int)> dfs = [&](int start) {
            res.push_back(path);                            // 每个节点都是一个子集 //@collect
            for (int i = start; i < (int)nums.size(); i++) {
                path.push_back(nums[i]);                    //@pick
                dfs(i + 1);                                 // 下一个只能从后面选 //@pick
                path.pop_back();
            }
        };
        dfs(0);                                             //@init
        return res;                                         //@done
    }
};
