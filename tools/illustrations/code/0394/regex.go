func decodeString(s string) string {
	// inner(i)：从下标 i 开始是不是「数字[纯字母]」（一定是最内层的括号），是的话返回次数、括号里的字母和结束位置
	inner := func(i int) (k int, t string, end int) { //@init
		j := i
		for j < len(s) && s[j] >= '0' && s[j] <= '9' {
			j++
		}
		if j == i || j == len(s) || s[j] != '[' {
			return 0, "", -1
		}
		e := j + 1
		for e < len(s) && s[e] >= 'a' && s[e] <= 'z' {
			e++
		}
		if e == len(s) || s[e] != ']' {
			return 0, "", -1
		}
		k, _ = strconv.Atoi(s[i:j])
		return k, s[j+1 : e], e + 1
	}
	for strings.Contains(s, "[") { //@round
		var b strings.Builder //@round
		for i := 0; i < len(s); {
			if k, t, end := inner(i); end >= 0 { //@expand
				b.WriteString(strings.Repeat(t, k)) //@expand
				i = end                             //@expand
			} else {
				b.WriteByte(s[i])
				i++
			}
		}
		s = b.String() //@expand
	}
	return s //@done
}
