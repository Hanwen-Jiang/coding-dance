class Solution {
public:
    vector<vector<int>> combinationSum(vector<int>& candidates, int target) {
        // 从下标 i 往后选，凑出 remain 的所有组合
        function<vector<vector<int>>(int, int)> dfs = [&](int i, int remain) -> vector<vector<int>> {
            if (remain == 0) {                              //@found
                return vector<vector<int>>(1);              // 一个空组合 //@found
            }
            if (i == (int)candidates.size() || remain < 0) {    //@empty
                return {};                                  //@empty
            }
            int c = candidates[i];                          //@take
            vector<vector<int>> res;
            for (auto& rest : dfs(i, remain - c)) {         // 再选一次 c //@take
                rest.insert(rest.begin(), c);               //@take
                res.push_back(rest);                        //@take
            }
            for (auto& rest : dfs(i + 1, remain)) {         // 以后都不选 c //@skip
                res.push_back(rest);                        //@skip
            }
            return res;
        };
        return dfs(0, target);                              //@start
    }
};
