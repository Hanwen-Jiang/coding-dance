class Solution {
public:
    vector<string> generateParenthesis(int n) {
        vector<string> res;                             //@init
        string path;                                    //@init
        dfs(n, 0, 0, path, res);                        //@init
        return res;                                     //@done
    }

private:
    void dfs(int n, int open, int close, string& path, vector<string>& res) {
        if ((int)path.size() == 2 * n) {                //@collect
            res.push_back(path);                        //@collect
            return;                                     //@collect
        }
        if (open < n) {                                 // 还能放左括号 //@open
            path.push_back('(');                        //@open
            dfs(n, open + 1, close, path, res);         //@open
            path.pop_back();
        }
        if (close < open) {                             // 右括号不能比左括号多 //@close
            path.push_back(')');                        //@close
            dfs(n, open, close + 1, path, res);         //@close
            path.pop_back();
        }
    }
};
