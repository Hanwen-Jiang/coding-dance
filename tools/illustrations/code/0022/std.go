func generateParenthesis(n int) []string {
	res, path := []string{}, []byte{} //@init
	var dfs func(open, close int)
	dfs = func(open, close int) {
		if len(path) == 2*n { //@collect
			res = append(res, string(path)) //@collect
			return                          //@collect
		}
		if open < n { // 还能放左括号 //@open
			path = append(path, '(') //@open
			dfs(open+1, close)       //@open
			path = path[:len(path)-1]
		}
		if close < open { // 右括号不能比左括号多 //@close
			path = append(path, ')') //@close
			dfs(open, close+1)       //@close
			path = path[:len(path)-1]
		}
	}
	dfs(0, 0)  //@init
	return res //@done
}
