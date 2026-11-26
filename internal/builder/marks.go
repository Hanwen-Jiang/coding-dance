package builder

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

var (
	markRegex      = regexp.MustCompile(`[ \t]*(?:#|//)@([\w-]+(?:,[\w-]+)*)[ \t]*$`)
	leadingNewline = regexp.MustCompile(`^\n+`)
)

type ParsedCode struct {
	Code  string           `json:"code"`
	Marks map[string][]int `json:"marks,omitempty"`
}

var FileLangs = []struct {
	ID  string
	Ext string
}{
	{"java", "java"},
	{"cpp", "cpp"},
	{"go", "go"},
	{"javascript", "js"},
	{"typescript", "ts"},
}

// ParseCode strips leading blank lines, trailing whitespace, and trailing #@tag / //@tag annotations,
// returning clean source code and 1-based tag -> line-number mappings identical to tools/illustrations/judge/code.js.
func ParseCode(src string) ParsedCode {
	normalized := strings.ReplaceAll(src, "\r\n", "\n")
	normalized = leadingNewline.ReplaceAllString(normalized, "")
	normalized = strings.TrimRight(normalized, " \t\n\r")

	if normalized == "" {
		return ParsedCode{Code: ""}
	}
	lines := strings.Split(normalized, "\n")
	marks := make(map[string][]int)
	for i, line := range lines {
		m := markRegex.FindStringSubmatchIndex(line)
		if m == nil {
			continue
		}
		tagList := line[m[2]:m[3]]
		for _, tag := range strings.Split(tagList, ",") {
			if tag != "" {
				marks[tag] = append(marks[tag], i+1)
			}
		}
		lines[i] = line[:m[0]]
	}
	out := ParsedCode{Code: strings.Join(lines, "\n")}
	if len(marks) > 0 {
		out.Marks = marks
	}
	return out
}

func sortedKeys(m map[string][]int) []string {
	if len(m) == 0 {
		return nil
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// CheckMarkParity verifies that a translated solution's //@tag set matches the Python reference #@tag set.
func CheckMarkParity(pyMarks map[string][]int, lang, rawSrc string) (ParsedCode, string) {
	parsed := ParseCode(rawSrc)
	want := strings.Join(sortedKeys(pyMarks), ",")
	got := strings.Join(sortedKeys(parsed.Marks), ",")
	if got != want {
		return parsed, fmt.Sprintf("%s 的标记是 [%s]，Python 的是 [%s]", lang, got, want)
	}
	return parsed, ""
}

// Mulberry32 implements the exact deterministic 32-bit PRNG from tools/illustrations/build.js
// so test case generation seeds produce identical floating-point sequences across JS and Go.
func Mulberry32(seed uint32) func() float64 {
	a := seed
	return func() float64 {
		a += 0x6d2b79f5
		t := (a ^ (a >> 15)) * (a | 1)
		t ^= t + ((t ^ (t >> 7)) * (t | 61))
		return float64(t^(t>>14)) / 4294967296.0
	}
}
