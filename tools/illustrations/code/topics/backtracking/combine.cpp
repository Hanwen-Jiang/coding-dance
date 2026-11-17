class Solution {
    vector<vector<int>> res;
    vector<int> path;

    void dfs(int n, int k, int start) {
        if ((int)path.size() == k) {            // 选够了 //@full
            res.push_back(path);                //@full
            return;                             //@full
        }
        int need = k - path.size();             // 还要选几个 //@choose
        for (int x = start; x <= n - need + 1; x++) {   // 剪枝：后面的数要够选 //@choose
            path.push_back(x);                  //@choose
            dfs(n, k, x + 1);                   //@choose
            path.pop_back();                    //@undo
        }
    }

public:
    vector<vector<int>> combine(int n, int k) {
        dfs(n, k, 1);                           //@start
        return res;                             //@done
    }
};
