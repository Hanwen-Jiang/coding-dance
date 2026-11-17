func letterCombinations(digits string) []string {
	if digits == "" {
		return []string{}
	}
	phone := []string{"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"} //@init
	res, path := []string{}, []byte{}                                                 //@init
	var dfs func(i int)
	dfs = func(i int) {
		if i == len(digits) { //@record
			res = append(res, string(path)) //@record
			return                          //@record
		}
		for _, ch := range []byte(phone[digits[i]-'0']) { //@pick
			path = append(path, ch) // 选 //@pick
			dfs(i + 1)              // 往下 //@pick
			path = path[:len(path)-1] // 撤销 //@undo
		}
	}
	dfs(0)     //@init
	return res //@done
}
