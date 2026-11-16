function generateParenthesis(n: number): string[] {
    const res: string[] = [], path: string[] = [];  //@init
    const dfs = (open: number, close: number): void => {
        if (path.length === 2 * n) {                //@collect
            res.push(path.join(""));                //@collect
            return;                                 //@collect
        }
        if (open < n) {                             // 还能放左括号 //@open
            path.push("(");                         //@open
            dfs(open + 1, close);                   //@open
            path.pop();
        }
        if (close < open) {                         // 右括号不能比左括号多 //@close
            path.push(")");                         //@close
            dfs(open, close + 1);                   //@close
            path.pop();
        }
    };
    dfs(0, 0);                                      //@init
    return res;                                     //@done
}
