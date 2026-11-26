package builder

import (
	"fmt"
	"math"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

func AcmArrayItem(typ string) string {
	if strings.HasSuffix(typ, "[]") {
		return typ[:len(typ)-2]
	}
	if strings.HasPrefix(typ, "List<") && strings.HasSuffix(typ, ">") {
		return typ[5 : len(typ)-1]
	}
	return ""
}

func isAcmAtomArray(typ string) bool {
	switch typ {
	case "int", "long", "double", "bool", "char", "nullable-int":
		return true
	default:
		return false
	}
}

func AcmOutputType(sig RawSignature) string {
	if sig.Ret == "void" {
		outIdx := 0
		if sig.Out != nil {
			outIdx = *sig.Out
		}
		if outIdx >= 0 && outIdx < len(sig.Params) {
			return sig.Params[outIdx]
		}
		return "void"
	}
	if sig.Ret == "" {
		return "void"
	}
	return sig.Ret
}

func encodeAcmAtom(value any, typ string) string {
	if typ == "NodeIndex" {
		if value == nil {
			return "-1"
		}
		return formatScalarJS(value)
	}
	if value == nil {
		return "null"
	}
	if typ == "bool" {
		if b, ok := value.(bool); ok && b {
			return "true"
		}
		return "false"
	}
	return formatScalarJS(value)
}

func formatScalarJS(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case bool:
		if x {
			return "true"
		}
		return "false"
	case float64:
		if x == 0 || (!math.IsNaN(x) && !math.IsInf(x, 0) && math.Abs(x) >= 1e-6 && math.Abs(x) < 1e21) {
			return strconv.FormatFloat(x, 'f', -1, 64)
		}
		return strconv.FormatFloat(x, 'g', -1, 64)
	case int:
		return strconv.Itoa(x)
	case int64:
		return strconv.FormatInt(x, 10)
	default:
		return fmt.Sprint(x)
	}
}

func EncodeAcmValue(value any, typ string) []string {
	switch typ {
	case "ListNode":
		if value == nil {
			return EncodeAcmValue([]any{}, "int[]")
		}
		return EncodeAcmValue(value, "int[]")
	case "TreeNode":
		if value == nil {
			return EncodeAcmValue([]any{}, "nullable-int[]")
		}
		return EncodeAcmValue(value, "nullable-int[]")
	case "CycleList", "JoinList":
		pair, _ := value.([]any)
		snd := "-1"
		if len(pair) > 1 && pair[1] != nil {
			snd = formatScalarJS(pair[1])
		}
		out := EncodeAcmValue(pair[0], "int[]")
		return append(out, snd)
	case "RandomList":
		rows, _ := value.([]any)
		out := []string{strconv.Itoa(len(rows))}
		for _, r := range rows {
			pair, _ := r.([]any)
			snd := "-1"
			if len(pair) > 1 && pair[1] != nil {
				snd = formatScalarJS(pair[1])
			}
			out = append(out, fmt.Sprintf("%s %s", formatScalarJS(pair[0]), snd))
		}
		return out
	}
	if item := AcmArrayItem(typ); item != "" {
		values, _ := value.([]any)
		out := []string{strconv.Itoa(len(values))}
		if isAcmAtomArray(item) {
			if len(values) > 0 {
				parts := make([]string, len(values))
				for i, v := range values {
					parts[i] = encodeAcmAtom(v, item)
				}
				out = append(out, strings.Join(parts, " "))
			}
			return out
		}
		for _, v := range values {
			out = append(out, EncodeAcmValue(v, item)...)
		}
		return out
	}
	return []string{encodeAcmAtom(value, typ)}
}

func EncodeAcmInput(input []any, sig RawSignature) string {
	if sig.Cls != "" {
		ops, _ := input[0].([]any)
		argv, _ := input[1].([]any)
		lines := make([]string, 0, 1+len(ops))
		lines = append(lines, strconv.Itoa(len(ops)))
		for i, opRaw := range ops {
			op, _ := opRaw.(string)
			row := []string{op}
			argsSlice, _ := argv[i].([]any)
			for _, v := range argsSlice {
				row = append(row, formatScalarJS(v))
			}
			lines = append(lines, strings.Join(row, " "))
		}
		return strings.Join(lines, "\n") + "\n"
	}
	var lines []string
	for i, t := range sig.Params {
		lines = append(lines, EncodeAcmValue(input[i], t)...)
	}
	return strings.Join(lines, "\n") + "\n"
}

func EncodeAcmOutput(value any, sig RawSignature) string {
	if sig.Cls != "" {
		arr, _ := value.([]any)
		lines := make([]string, len(arr))
		for i, v := range arr {
			if v == nil {
				lines[i] = "null"
			} else {
				lines[i] = formatScalarJS(v)
			}
		}
		return strings.Join(lines, "\n") + "\n"
	}
	return strings.Join(EncodeAcmValue(value, AcmOutputType(sig)), "\n") + "\n"
}

type acmReader struct {
	lines []string
	at    int
}

func newAcmReader(text string) *acmReader {
	clean := strings.ReplaceAll(text, "\r", "")
	lines := strings.Split(clean, "\n")
	if strings.HasSuffix(text, "\n") && len(lines) > 0 {
		lines = lines[:len(lines)-1]
	}
	return &acmReader{lines: lines}
}

func (r *acmReader) line() (string, error) {
	if r.at >= len(r.lines) {
		return "", fmt.Errorf("输入提前结束，请按题面补齐数据。")
	}
	l := r.lines[r.at]
	r.at++
	return l, nil
}

var nonNegIntRe = regexp.MustCompile(`^\d+$`)

func (r *acmReader) count() (int, error) {
	raw, err := r.line()
	if err != nil {
		return 0, err
	}
	s := strings.TrimSpace(raw)
	if !nonNegIntRe.MatchString(s) {
		return 0, fmt.Errorf("长度必须是非负整数，实际读到：%s", s)
	}
	n, _ := strconv.Atoi(s)
	if n > 100000 {
		return 0, fmt.Errorf("单个序列长度不能超过 100000。")
	}
	return n, nil
}

func (r *acmReader) tokens(n int) ([]string, error) {
	var tokens []string
	for len(tokens) < n {
		raw, err := r.line()
		if err != nil {
			return nil, err
		}
		if s := strings.TrimSpace(raw); s != "" {
			tokens = append(tokens, strings.Fields(s)...)
		}
	}
	if len(tokens) != n {
		return nil, fmt.Errorf("序列声明了 %d 个元素，却读到 %d 个。", n, len(tokens))
	}
	return tokens, nil
}

func (r *acmReader) done() error {
	for i := r.at; i < len(r.lines); i++ {
		if strings.TrimSpace(r.lines[i]) != "" {
			return fmt.Errorf("输出包含多余内容；请仅输出题目要求的结果。")
		}
	}
	return nil
}

func parseAcmBoolWord(word string) (bool, bool) {
	switch word {
	case "true", "True":
		return true, true
	case "false", "False":
		return false, true
	default:
		return false, false
	}
}

func parseAcmAtom(text, typ string) (any, error) {
	s := strings.TrimSpace(text)
	if typ == "string" {
		return text, nil
	}
	if typ == "char" {
		if len([]rune(text)) != 1 {
			return nil, fmt.Errorf("字符必须恰好包含一个字符。")
		}
		return text, nil
	}
	if typ == "void" {
		if s != "null" {
			return nil, fmt.Errorf("无返回值操作应输出 null。")
		}
		return nil, nil
	}
	if (typ == "TreeVal" || typ == "nullable-int") && s == "null" {
		return nil, nil
	}
	if typ == "NodeIndex" && (s == "-1" || s == "null") {
		return nil, nil
	}
	if typ == "bool" {
		if b, ok := parseAcmBoolWord(s); ok {
			return b, nil
		}
		if s == "1" || s == "0" {
			return s == "1", nil
		}
		return nil, fmt.Errorf("布尔值应为 true 或 false（也接受 True 或 False），实际读到：%s", s)
	}
	if s == "" {
		return nil, fmt.Errorf("应为数值，实际读到：")
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
		return nil, fmt.Errorf("应为数值，实际读到：%s", s)
	}
	if typ != "double" && f != math.Trunc(f) {
		return nil, fmt.Errorf("应为整数，实际读到：%s", s)
	}
	return f, nil
}

func readAcmValue(r *acmReader, typ string) (any, error) {
	switch typ {
	case "ListNode":
		return readAcmValue(r, "int[]")
	case "TreeNode":
		return readAcmValue(r, "nullable-int[]")
	case "CycleList", "JoinList":
		a, err := readAcmValue(r, "int[]")
		if err != nil {
			return nil, err
		}
		b, err := readAcmValue(r, "int")
		if err != nil {
			return nil, err
		}
		return []any{a, b}, nil
	case "RandomList":
		cnt, err := r.count()
		if err != nil {
			return nil, err
		}
		rows := make([]any, cnt)
		for i := 0; i < cnt; i++ {
			toks, err := r.tokens(2)
			if err != nil {
				return nil, err
			}
			v0, err := parseAcmAtom(toks[0], "int")
			if err != nil {
				return nil, err
			}
			v1, err := parseAcmAtom(toks[1], "int")
			if err != nil {
				return nil, err
			}
			if f1, ok := v1.(float64); ok && f1 == -1 {
				rows[i] = []any{v0, nil}
			} else {
				rows[i] = []any{v0, v1}
			}
		}
		return rows, nil
	}
	if item := AcmArrayItem(typ); item != "" {
		cnt, err := r.count()
		if err != nil {
			return nil, err
		}
		if isAcmAtomArray(item) {
			toks, err := r.tokens(cnt)
			if err != nil {
				return nil, err
			}
			out := make([]any, cnt)
			for i, tok := range toks {
				v, err := parseAcmAtom(tok, item)
				if err != nil {
					return nil, err
				}
				out[i] = v
			}
			return out, nil
		}
		out := make([]any, cnt)
		for i := 0; i < cnt; i++ {
			v, err := readAcmValue(r, item)
			if err != nil {
				return nil, err
			}
			out[i] = v
		}
		return out, nil
	}
	raw, err := r.line()
	if err != nil {
		return nil, err
	}
	return parseAcmAtom(raw, typ)
}

func DecodeAcmInput(stdin string, sig RawSignature) ([]any, error) {
	r := newAcmReader(stdin)
	if sig.Cls != "" {
		n, err := r.count()
		if err != nil {
			return nil, err
		}
		ops := make([]any, 0, n)
		argv := make([]any, 0, n)
		for i := 0; i < n; i++ {
			raw, err := r.line()
			if err != nil {
				return nil, err
			}
			fields := strings.Fields(strings.TrimSpace(raw))
			if len(fields) == 0 {
				return nil, fmt.Errorf("无效操作：")
			}
			op := fields[0]
			toks := fields[1:]
			var types []string
			if i == 0 {
				if op != sig.Cls {
					return nil, fmt.Errorf("无效操作：%s。第一条必须是 %s。", op, sig.Cls)
				}
				types = sig.Ctor
			} else {
				m, ok := sig.Methods.Lookup(op)
				if !ok {
					return nil, fmt.Errorf("无效操作：%s。", op)
				}
				types = m.Params
			}
			if len(toks) != len(types) {
				return nil, fmt.Errorf("%s 应有 %d 个参数。", op, len(types))
			}
			rowArgs := make([]any, len(types))
			for j, tok := range toks {
				v, err := parseAcmAtom(tok, types[j])
				if err != nil {
					return nil, err
				}
				rowArgs[j] = v
			}
			ops = append(ops, op)
			argv = append(argv, rowArgs)
		}
		if err := r.done(); err != nil {
			return nil, err
		}
		return []any{ops, argv}, nil
	}
	input := make([]any, len(sig.Params))
	for i, t := range sig.Params {
		v, err := readAcmValue(r, t)
		if err != nil {
			return nil, err
		}
		input[i] = v
	}
	if err := r.done(); err != nil {
		return nil, err
	}
	return input, nil
}

func ParseAcmOutput(stdout string, sig RawSignature) (any, error) {
	if sig.Cls != "" {
		var out []any
		for _, line := range strings.Split(strings.ReplaceAll(stdout, "\r\n", "\n"), "\n") {
			s := strings.TrimSpace(line)
			if s == "" {
				continue
			}
			if s == "null" {
				out = append(out, nil)
				continue
			}
			if b, ok := parseAcmBoolWord(s); ok {
				out = append(out, b)
				continue
			}
			v, err := parseAcmAtom(s, "double")
			if err != nil {
				return nil, err
			}
			out = append(out, v)
		}
		return out, nil
	}
	r := newAcmReader(stdout)
	v, err := readAcmValue(r, AcmOutputType(sig))
	if err != nil {
		return nil, err
	}
	if err := r.done(); err != nil {
		return nil, err
	}
	return v, nil
}

// ComparePracticeOutput mirrors site/lib/practice/compare.ts.
func ComparePracticeOutput(id int, sig RawSignature, input []any, expected, actual any) bool {
	floating := strings.Contains(sig.Ret, "double")
	if !floating {
		for _, m := range sig.Methods {
			if strings.Contains(m.Ret, "double") {
				floating = true
				break
			}
		}
	}
	equalVal := func(a, b any) bool {
		return compareEqual(a, b, floating)
	}

	switch id {
	case 1:
		act, ok := actual.([]any)
		nums, ok2 := input[0].([]any)
		tgt, ok3 := input[1].(float64)
		if !ok || len(act) != 2 || !ok2 || !ok3 {
			return false
		}
		iF, okI := act[0].(float64)
		jF, okJ := act[1].(float64)
		if !okI || !okJ || iF != math.Trunc(iF) || jF != math.Trunc(jF) {
			return false
		}
		i, j := int(iF), int(jF)
		if i == j || i < 0 || j < 0 || i >= len(nums) || j >= len(nums) {
			return false
		}
		vi, _ := nums[i].(float64)
		vj, _ := nums[j].(float64)
		return vi+vj == tgt
	case 5:
		act, ok1 := actual.(string)
		exp, ok2 := expected.(string)
		inS, ok3 := input[0].(string)
		if !ok1 || !ok2 || !ok3 {
			return false
		}
		if len(act) != len(exp) || !strings.Contains(inS, act) {
			return false
		}
		runes := []rune(act)
		for l, r := 0, len(runes)-1; l < r; l, r = l+1, r-1 {
			if runes[l] != runes[r] {
				return false
			}
		}
		return true
	case 76:
		act, ok1 := actual.(string)
		exp, ok2 := expected.(string)
		s, ok3 := input[0].(string)
		t, ok4 := input[1].(string)
		if !ok1 || !ok2 || !ok3 || !ok4 {
			return false
		}
		if len(act) != len(exp) || !strings.Contains(s, act) {
			return false
		}
		if act == "" && exp == "" {
			return true
		}
		counts := map[rune]int{}
		for _, c := range act {
			counts[c]++
		}
		for _, c := range t {
			if counts[c] == 0 {
				return false
			}
			counts[c]--
		}
		return true
	case 347:
		nums, ok1 := input[0].([]any)
		kF, ok2 := input[1].(float64)
		act, ok3 := actual.([]any)
		if !ok1 || !ok2 || !ok3 {
			return false
		}
		k := int(kF)
		if len(act) != k {
			return false
		}
		seen := map[string]bool{}
		for _, v := range act {
			key := CompactJSONString(v)
			if seen[key] {
				return false
			}
			seen[key] = true
		}
		counts := map[string]int{}
		for _, v := range nums {
			counts[CompactJSONString(v)]++
		}
		var freqs []int
		for _, c := range counts {
			freqs = append(freqs, c)
		}
		sort.Slice(freqs, func(i, j int) bool { return freqs[i] > freqs[j] })
		threshold := freqs[k-1]
		for _, v := range act {
			if counts[CompactJSONString(v)] < threshold {
				return false
			}
		}
		for valKey, cnt := range counts {
			if cnt > threshold && !seen[valKey] {
				return false
			}
		}
		return true
	case 108:
		act, ok1 := actual.([]any)
		inArr, ok2 := input[0].([]any)
		if !ok1 || !ok2 || len(act) > 100000 {
			return false
		}
		type node struct {
			val   any
			left  int
			right int
		}
		var nodes []node
		if len(act) > 0 && act[0] != nil {
			nodes = append(nodes, node{val: act[0], left: -1, right: -1})
		}
		i := 1
		for n := 0; n < len(nodes) && i < len(act); n++ {
			if i < len(act) {
				v := act[i]
				i++
				if v != nil {
					nodes[n].left = len(nodes)
					nodes = append(nodes, node{val: v, left: -1, right: -1})
				}
			}
			if i < len(act) {
				v := act[i]
				i++
				if v != nil {
					nodes[n].right = len(nodes)
					nodes = append(nodes, node{val: v, left: -1, right: -1})
				}
			}
		}
		for ; i < len(act); i++ {
			if act[i] != nil {
				return false
			}
		}
		heights := make([]int, len(nodes))
		for n := len(nodes) - 1; n >= 0; n-- {
			lh, rh := 0, 0
			if nodes[n].left >= 0 {
				lh = heights[nodes[n].left]
			}
			if nodes[n].right >= 0 {
				rh = heights[nodes[n].right]
			}
			if lh-rh > 1 || rh-lh > 1 {
				return false
			}
			if lh > rh {
				heights[n] = 1 + lh
			} else {
				heights[n] = 1 + rh
			}
		}
		var inorder []any
		var stack []int
		cursor := -1
		if len(nodes) > 0 {
			cursor = 0
		}
		for cursor >= 0 || len(stack) > 0 {
			for cursor >= 0 {
				stack = append(stack, cursor)
				cursor = nodes[cursor].left
			}
			n := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			inorder = append(inorder, nodes[n].val)
			cursor = nodes[n].right
		}
		return equalVal(inorder, inArr)
	}

	if sig.Cmp == "unordered" || slicesHasInt([]int{15, 17, 22, 39, 46, 49, 51, 78, 90, 131}, id) {
		expArr, ok1 := expected.([]any)
		actArr, ok2 := actual.([]any)
		if !ok1 || !ok2 {
			return false
		}
		bothLevels := slicesHasInt([]int{15, 39, 49, 78, 90}, id)
		norm := func(vals []any) []any {
			out := make([]any, len(vals))
			for i, x := range vals {
				if bothLevels {
					if inner, ok := x.([]any); ok {
						out[i] = sortedJSONSlice(inner)
						continue
					}
				}
				out[i] = x
			}
			return sortedJSONSlice(out)
		}
		return equalVal(norm(expArr), norm(actArr))
	}
	return equalVal(expected, actual)
}

func sortedJSONSlice(vals []any) []any {
	out := append([]any(nil), vals...)
	sort.Slice(out, func(i, j int) bool {
		return CompactJSONString(out[i]) < CompactJSONString(out[j])
	})
	return out
}

func slicesHasInt(s []int, target int) bool {
	for _, x := range s {
		if x == target {
			return true
		}
	}
	return false
}

func compareEqual(a, b any, floating bool) bool {
	if af, ok1 := a.(float64); ok1 {
		bf, ok2 := b.(float64)
		if !ok2 || math.IsNaN(af) || math.IsInf(af, 0) || math.IsNaN(bf) || math.IsInf(bf, 0) {
			return false
		}
		if floating {
			scale := math.Max(1, math.Max(math.Abs(af), math.Abs(bf)))
			return math.Abs(af-bf) <= 1e-6*scale
		}
		return af == bf
	}
	if aa, ok1 := a.([]any); ok1 {
		ba, ok2 := b.([]any)
		if !ok2 || len(aa) != len(ba) {
			return false
		}
		for i := range aa {
			if !compareEqual(aa[i], ba[i], floating) {
				return false
			}
		}
		return true
	}
	return reflect.DeepEqual(a, b)
}
