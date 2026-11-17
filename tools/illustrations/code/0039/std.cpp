class Solution {
public:
    vector<vector<int>> combinationSum(vector<int>& candidates, int target) {
        sort(candidates.begin(), candidates.end());         //@init
        vector<vector<int>> res;                            //@init
        vector<int> path;                                   //@init
        function<void(int, int)> dfs = [&](int start, int remain) {
            if (remain == 0) {                              //@found
                res.push_back(path);                        //@found
                return;                                     //@found
            }
            for (int i = start; i < (int)candidates.size(); i++) {
                if (candidates[i] > remain) {               // 排过序，后面的只会更大 //@prune
                    break;                                  //@prune
                }
                path.push_back(candidates[i]);              //@pick
                dfs(i, remain - candidates[i]);             // 还从 i 开始：可以重复选 //@pick
                path.pop_back();
            }
        };
        dfs(0, target);                                     //@init
        return res;                                         //@done
    }
};
