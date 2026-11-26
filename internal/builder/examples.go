package builder

import (
	"fmt"
	"html"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

type OfficialExampleSource struct {
	Path   string `json:"path"`
	Index  int    `json:"index"`
	Input  string `json:"input"`
	Output string `json:"output"`
}

type ParsedOfficialExample struct {
	Index          int            `json:"index"`
	Path           string         `json:"path"`
	InputText      string         `json:"inputText"`
	OutputText     string         `json:"outputText"`
	Fields         map[string]any `json:"fields"`
	Values         []any          `json:"values"`
	OutputValue    any            `json:"outputValue"`
	HasOutputValue bool           `json:"hasOutputValue"`
}

var (
	htmlTagRe     = regexp.MustCompile(`<[^>]+>`)
	blockStartRe  = regexp.MustCompile(`(?i)</?(?:p|div|pre|li|br)\b[^>]*>`)
	supTagRe      = regexp.MustCompile(`(?i)<sup>(.*?)</sup>`)
	subTagRe      = regexp.MustCompile(`(?i)<sub>(.*?)</sub>`)
	multiSpaceRe  = regexp.MustCompile(`\s+`)
	liItemRe      = regexp.MustCompile(`(?s)<li>(.*?)</li>`)
	exampleHeadRe = regexp.MustCompile(`(?:^|\n)\s*示例\s*(\d*)\s*[:：]\s*`)
	exampleIORe   = regexp.MustCompile(`(?s)输入\s*[:：]?\s*(.*?)输出\s*[:：]?\s*(.*)`)
	exampleTailRe = regexp.MustCompile(`(?:^|\n)\s*(?:解释|说明|提示|进阶)\s*(?:[:：]|\n)`)
	fieldAssignRe = regexp.MustCompile(`(?s)^(\w+)\s*=\s*(.*)$`)
	idxRe         = regexp.MustCompile(`索引为\s*(\d+)`)
)

func htmlToPlainExampleText(rawHTML string) string {
	var b strings.Builder
	last := 0
	for _, m := range htmlTagRe.FindAllStringIndex(rawHTML, -1) {
		b.WriteString(rawHTML[last:m[0]])
		tag := strings.ToLower(rawHTML[m[0]:m[1]])
		// Match official-examples.py HTMLParser start/end newlines for p, div, pre, li, br
		trimmed := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(tag, "<"), ">"))
		closing := strings.HasPrefix(trimmed, "/")
		if closing {
			trimmed = strings.TrimSpace(trimmed[1:])
		}
		if i := strings.IndexAny(trimmed, " \t\r\n/"); i >= 0 {
			trimmed = trimmed[:i]
		}
		if trimmed == "p" || trimmed == "div" || trimmed == "pre" || trimmed == "li" || (!closing && trimmed == "br") {
			b.WriteByte('\n')
		}
		last = m[1]
	}
	b.WriteString(rawHTML[last:])
	s := html.UnescapeString(b.String())
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\u00a0", " ")
	return s
}

func splitTopLevelValues(value string) []string {
	var result []string
	depth := 0
	var quote byte
	escape := false
	start := 0
	for i := 0; i < len(value); i++ {
		ch := value[i]
		if quote != 0 {
			if escape {
				escape = false
			} else if ch == '\\' {
				escape = true
			} else if ch == quote {
				quote = 0
			}
			continue
		}
		switch ch {
		case '\'', '"':
			quote = ch
		case '[', '(', '{':
			depth++
		case ']', ')', '}':
			depth--
		case ',', '\n':
			if depth == 0 {
				if part := strings.TrimSpace(value[start:i]); part != "" {
					result = append(result, part)
				}
				start = i + 1
			}
		}
	}
	if part := strings.TrimSpace(value[start:]); part != "" {
		result = append(result, part)
	}
	return result
}

// parsePythonOrJSONLiteral evaluates literals as official-examples.py's ast.literal_eval + null/true/false does,
// supporting single-quoted strings, None/True/False, negative numbers, tuples, and lists without eval.
func parsePythonOrJSONLiteral(raw string) (any, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, fmt.Errorf("empty literal")
	}
	pos := 0
	skipWS := func() {
		for pos < len(s) && (s[pos] == ' ' || s[pos] == '\t' || s[pos] == '\n' || s[pos] == '\r') {
			pos++
		}
	}
	var parseVal func() (any, error)
	parseStr := func(q byte) (string, error) {
		pos++ // consume quote
		var out strings.Builder
		for pos < len(s) {
			ch := s[pos]
			if ch == q {
				pos++
				return out.String(), nil
			}
			if ch == '\\' {
				pos++
				if pos >= len(s) {
					return "", fmt.Errorf("unterminated escape")
				}
				esc := s[pos]
				pos++
				switch esc {
				case 'n':
					out.WriteByte('\n')
				case 'r':
					out.WriteByte('\r')
				case 't':
					out.WriteByte('\t')
				case '\\', '\'', '"':
					out.WriteByte(esc)
				default:
					out.WriteByte('\\')
					out.WriteByte(esc)
				}
				continue
			}
			out.WriteByte(ch)
			pos++
		}
		return "", fmt.Errorf("unterminated string")
	}
	parseVal = func() (any, error) {
		skipWS()
		if pos >= len(s) {
			return nil, fmt.Errorf("unexpected EOF")
		}
		ch := s[pos]
		if ch == '"' || ch == '\'' {
			return parseStr(ch)
		}
		if ch == '[' || ch == '(' {
			closeCh := byte(']')
			if ch == '(' {
				closeCh = ')'
			}
			pos++
			items := []any{}
			for {
				skipWS()
				if pos >= len(s) {
					return nil, fmt.Errorf("unclosed list")
				}
				if s[pos] == closeCh {
					pos++
					return items, nil
				}
				v, err := parseVal()
				if err != nil {
					return nil, err
				}
				items = append(items, v)
				skipWS()
				if pos < len(s) && s[pos] == ',' {
					pos++
					continue
				}
				if pos < len(s) && s[pos] == closeCh {
					pos++
					return items, nil
				}
				return nil, fmt.Errorf("expected ',' or '%c' at %d in %q", closeCh, pos, s)
			}
		}
		// identifier or number
		start := pos
		for pos < len(s) && !strings.ContainsRune(",])}\n\r\t ", rune(s[pos])) {
			pos++
		}
		tok := s[start:pos]
		switch tok {
		case "null", "None":
			return nil, nil
		case "true", "True":
			return true, nil
		case "false", "False":
			return false, nil
		}
		// Ensure numeric literals parse as float64 cleanly (matching Go's encoding/json Interface decode).
		f, err := strconv.ParseFloat(tok, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid literal %q", tok)
		}
		return f, nil
	}
	v, err := parseVal()
	if err != nil {
		return nil, err
	}
	skipWS()
	if pos != len(s) {
		return nil, fmt.Errorf("trailing literal content %q", s[pos:])
	}
	return v, nil
}

func ParseProblemMarkdownExamples(mdRelPath, mdContent string) ([]ParsedOfficialExample, []string, error) {
	beforeDiagram, _, _ := strings.Cut(mdContent, "## 思路图解")

	// Extract constraints ("数据范围：...") from last "提示：</strong>"
	var constraints []string
	if idx := strings.LastIndex(beforeDiagram, "提示：</strong>"); idx >= 0 {
		for _, m := range liItemRe.FindAllStringSubmatch(beforeDiagram[idx:], -1) {
			txt := supTagRe.ReplaceAllString(m[1], "^$1")
			txt = subTagRe.ReplaceAllString(txt, "_$1")
			txt = htmlTagRe.ReplaceAllString(txt, "")
			txt = html.UnescapeString(txt)
			txt = strings.ReplaceAll(txt, "\u00a0", " ")
			txt = strings.TrimSpace(multiSpaceRe.ReplaceAllString(txt, " "))
			constraints = append(constraints, "数据范围："+txt)
		}
	}

	_, afterDesc, ok := strings.Cut(beforeDiagram, "## 题目描述")
	if !ok {
		return nil, constraints, fmt.Errorf("%s missing ## 题目描述", mdRelPath)
	}
	plain := htmlToPlainExampleText(afterDesc)
	headings := exampleHeadRe.FindAllStringSubmatchIndex(plain, -1)
	if len(headings) == 0 {
		return nil, constraints, fmt.Errorf("no official examples found in %s", mdRelPath)
	}

	var out []ParsedOfficialExample
	for i, h := range headings {
		secEnd := len(plain)
		if i+1 < len(headings) {
			secEnd = headings[i+1][0]
		}
		section := plain[h[1]:secEnd]
		idxNum := i + 1
		if h[2] < h[3] {
			if parsedIdx, err := strconv.Atoi(plain[h[2]:h[3]]); err == nil {
				idxNum = parsedIdx
			}
		}
		ioMatch := exampleIORe.FindStringSubmatch(section)
		if ioMatch == nil {
			return nil, constraints, fmt.Errorf("%s example %d missing 输入/输出", mdRelPath, idxNum)
		}
		rawIn := strings.TrimSpace(ioMatch[1])
		rawOut := ioMatch[2]
		if loc := exampleTailRe.FindStringIndex(rawOut); loc != nil {
			rawOut = rawOut[:loc[0]]
		}
		rawOut = strings.TrimSpace(rawOut)

		fields := make(map[string]any)
		var ordered []any
		for _, part := range splitTopLevelValues(rawIn) {
			if m := fieldAssignRe.FindStringSubmatch(part); m != nil {
				val, err := parsePythonOrJSONLiteral(m[2])
				if err != nil {
					return nil, constraints, fmt.Errorf("%s example %d input %q: %w", mdRelPath, idxNum, m[2], err)
				}
				fields[m[1]] = val
				ordered = append(ordered, val)
			} else {
				val, err := parsePythonOrJSONLiteral(part)
				if err != nil {
					return nil, constraints, fmt.Errorf("%s example %d input %q: %w", mdRelPath, idxNum, part, err)
				}
				ordered = append(ordered, val)
			}
		}

		outVal, outErr := parsePythonOrJSONLiteral(rawOut)
		out = append(out, ParsedOfficialExample{
			Index:          idxNum,
			Path:           filepath.ToSlash(mdRelPath),
			InputText:      rawIn,
			OutputText:     rawOut,
			Fields:         fields,
			Values:         ordered,
			OutputValue:    outVal,
			HasOutputValue: outErr == nil,
		})
	}
	return out, constraints, nil
}

func OfficialExampleInput(id int, sig RawSignature, ex ParsedOfficialExample) ([]any, error) {
	if id == 141 || id == 142 {
		return []any{[]any{ex.Fields["head"], ex.Fields["pos"]}}, nil
	}
	if id == 160 {
		listA := ex.Fields["listA"]
		listB, _ := ex.Fields["listB"].([]any)
		iv, _ := ex.Fields["intersectVal"].(float64)
		var prefix any
		var skipA any
		if iv == 0 {
			prefix = listB
			skipA = float64(-1)
		} else {
			skipB, _ := ex.Fields["skipB"].(float64)
			nb := int(skipB)
			if nb > len(listB) {
				nb = len(listB)
			}
			prefix = append([]any{}, listB[:nb]...)
			skipA = ex.Fields["skipA"]
		}
		return []any{listA, []any{prefix, skipA}}, nil
	}
	if sig.Cls != "" {
		if len(ex.Values) != 2 {
			return nil, fmt.Errorf("%d: invalid official design example", id)
		}
		return ex.Values, nil
	}
	if len(ex.Values) != len(sig.Params) {
		return nil, fmt.Errorf("%d: official example arity mismatch (%d vs %d)", id, len(ex.Values), len(sig.Params))
	}
	return ex.Values, nil
}

func OfficialExampleExpected(id int, ex ParsedOfficialExample) (any, error) {
	if ex.HasOutputValue {
		return ex.OutputValue, nil
	}
	if id == 142 {
		if m := idxRe.FindStringSubmatch(ex.OutputText); m != nil {
			n, _ := strconv.Atoi(m[1])
			return float64(n), nil
		}
		if strings.Contains(ex.OutputText, "null") {
			return nil, nil
		}
	}
	if id == 160 {
		iv, _ := ex.Fields["intersectVal"].(float64)
		if iv == 0 {
			return nil, nil
		}
		return ex.Fields["skipA"], nil
	}
	return nil, fmt.Errorf("%d: official example output %q cannot be verified", id, ex.OutputText)
}

func FindProblemMarkdownPath(repoRoot string, id int) (string, error) {
	prefix := fmt.Sprintf("%04d.", id)
	probDir := filepath.Join(repoRoot, "problems")
	entries, err := os.ReadDir(probDir)
	if err != nil {
		return "", err
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasPrefix(e.Name(), prefix) && strings.HasSuffix(e.Name(), ".md") {
			return filepath.ToSlash(filepath.Join("problems", e.Name())), nil
		}
	}
	return "", fmt.Errorf("missing problem markdown for %04d", id)
}

var probFileRe = regexp.MustCompile(`^(\d{4})\..*\.md$`)

// DumpOfficialExamples parses all problems/*.md files and returns official examples keyed by problem ID string.
func DumpOfficialExamples(repoRoot string) (map[string][]ParsedOfficialExample, error) {
	probDir := filepath.Join(repoRoot, "problems")
	entries, err := os.ReadDir(probDir)
	if err != nil {
		return nil, err
	}
	out := make(map[string][]ParsedOfficialExample)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		m := probFileRe.FindStringSubmatch(e.Name())
		if m == nil {
			continue
		}
		id, _ := strconv.Atoi(m[1])
		relPath := filepath.ToSlash(filepath.Join("problems", e.Name()))
		raw, err := os.ReadFile(filepath.Join(probDir, e.Name()))
		if err != nil {
			return nil, err
		}
		exs, _, err := ParseProblemMarkdownExamples(relPath, string(raw))
		if err != nil {
			return nil, err
		}
		out[strconv.Itoa(id)] = exs
	}
	return out, nil
}
