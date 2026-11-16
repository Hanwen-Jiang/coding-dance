func groupAnagrams(strs []string) [][]string {
	groups := map[string][]string{} //@init
	for _, s := range strs {
		b := []byte(s)                                         //@key
		sort.Slice(b, func(i, j int) bool { return b[i] < b[j] }) // 异位词排序后相同 //@key
		key := string(b)                                       //@key
		groups[key] = append(groups[key], s)                   //@add
	}
	res := make([][]string, 0, len(groups)) //@done
	for _, g := range groups {               //@done
		res = append(res, g) //@done
	}
	return res //@done
}
