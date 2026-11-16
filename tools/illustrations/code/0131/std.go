func partition(s string) [][]string {
	res, path := [][]string{}, []string{} //@init
	isPal := func(t string) bool {
		for i, j := 0, len(t)-1; i < j; i, j = i+1, j-1 {
			if t[i] != t[j] {
				return false
			}
		}
		return true
	}
	var dfs func(start int)
	dfs = func(start int) {
		if start == len(s) { //@collect
			res = append(res, append([]string(nil), path...)) //@collect
			return                                            //@collect
		}
		for end := start + 1; end <= len(s); end++ { //@try
			piece := s[start:end] //@try
			if isPal(piece) {     // 这一段是回文才切 //@try,cut
				path = append(path, piece) //@cut
				dfs(end)                   //@cut
				path = path[:len(path)-1]
			}
		}
	}
	dfs(0)     //@init
	return res //@done
}
