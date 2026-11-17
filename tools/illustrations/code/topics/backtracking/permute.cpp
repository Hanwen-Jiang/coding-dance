class Solution {
    vector<vector<int>> res;
    vector<int> path;
    vector<bool> used;

    void dfs(vector<int>& nums) {
        if (path.size() == nums.size()) {       // 放满了：一个排列 //@full
            res.push_back(path);                //@full
            return;                             //@full
        }
        for (int j = 0; j < (int)nums.size(); j++) {    // 每个位置可以放任何一个还没用过的数 //@choose
            if (used[j]) {                      //@choose
                continue;                       //@choose
            }
            used[j] = true;                     //@choose
            path.push_back(nums[j]);            //@choose
            dfs(nums);                          //@choose
            path.pop_back();                    // 撤销 //@undo
            used[j] = false;                    //@undo
        }
    }

public:
    vector<vector<int>> permute(vector<int>& nums) {
        used.assign(nums.size(), false);
        dfs(nums);                              //@start
        return res;                             //@done
    }
};
