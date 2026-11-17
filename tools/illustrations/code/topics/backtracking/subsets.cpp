class Solution {
    vector<vector<int>> res;
    vector<int> path;

    // 接下来只能从 nums[i:] 里选
    void dfs(vector<int>& nums, int i) {
        res.push_back(path);                    // 树上每个节点都是一个子集 //@record
        for (int j = i; j < (int)nums.size(); j++) {    //@choose
            path.push_back(nums[j]);            // 选 nums[j] //@choose
            dfs(nums, j + 1);                   // 下一个只能从 j+1 开始选，不会重复 //@choose
            path.pop_back();                    // 撤销，换下一个 //@undo
        }
    }

public:
    vector<vector<int>> subsets(vector<int>& nums) {
        dfs(nums, 0);                           //@start
        return res;                             //@done
    }
};
