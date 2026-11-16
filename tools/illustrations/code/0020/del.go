func isValid(s string) bool {
	for strings.Contains(s, "()") || strings.Contains(s, "[]") || strings.Contains(s, "{}") { //@round
		s = strings.NewReplacer("()", "", "[]", "", "{}", "").Replace(s) //@del
	}
	return s == "" //@done
}
