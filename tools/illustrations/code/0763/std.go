func partitionLabels(s string) []int {
	last := [26]int{} // 每个字母最后出现的位置 //@init
	for i := 0; i < len(s); i++ { //@init
		last[s[i]-'a'] = i //@init
	}
	res, start, end := []int{}, 0, 0 //@init
	for i := 0; i < len(s); i++ { //@grow
		end = max(end, last[s[i]-'a']) // 这一段至少要到 end //@grow
		if i == end { // 走到边界，切一刀 //@cut
			res = append(res, end-start+1) //@cut
			start = i + 1                  //@cut
		}
	}
	return res //@done
}
