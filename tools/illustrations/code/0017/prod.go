func letterCombinations(digits string) []string {
	if digits == "" { //@empty
		return []string{} //@empty
	}
	phone := []string{"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"} //@init
	combos := []string{""}                                                            // 一开始只有一个空前缀 //@init
	for _, d := range digits { //@mul
		next := []string{} //@mul
		for _, c := range combos { //@mul
			for _, ch := range phone[d-'0'] { //@mul
				next = append(next, c+string(ch)) // 每个前缀后面接上这一位的每个字母 //@mul
			}
		}
		combos = next //@mul
	}
	return combos //@done
}
