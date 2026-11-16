class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> res = new ArrayList<>();           //@init
        dfs(n, 0, 0, new StringBuilder(), res);         //@init
        return res;                                     //@done
    }

    private void dfs(int n, int open, int close, StringBuilder path, List<String> res) {
        if (path.length() == 2 * n) {                   //@collect
            res.add(path.toString());                   //@collect
            return;                                     //@collect
        }
        if (open < n) {                                 // 还能放左括号 //@open
            path.append('(');                           //@open
            dfs(n, open + 1, close, path, res);         //@open
            path.deleteCharAt(path.length() - 1);
        }
        if (close < open) {                             // 右括号不能比左括号多 //@close
            path.append(')');                           //@close
            dfs(n, open, close + 1, path, res);         //@close
            path.deleteCharAt(path.length() - 1);
        }
    }
}
