package progress

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
)

var PracticeExt = map[string]string{
	"python": ".py", "javascript": ".js", "typescript": ".ts", "java": ".java", "cpp": ".cpp", "go": ".go",
	"c": ".c", "csharp": ".cs", "kotlin": ".kt", "swift": ".swift", "rust": ".rs", "ruby": ".rb", "php": ".php", "scala": ".scala", "dart": ".dart",
}

var LangLabel = map[string]string{
	"python": "Python", "javascript": "JavaScript", "typescript": "TypeScript", "java": "Java", "cpp": "C++", "go": "Go",
	"c": "C", "csharp": "C#", "kotlin": "Kotlin", "swift": "Swift", "rust": "Rust", "ruby": "Ruby", "php": "PHP", "scala": "Scala", "dart": "Dart",
}

var (
	ValidStatuses = []string{"已通过", "曾通过", "尝试过", "未开始"}
	ValidResults  = []string{"通过", "答案错误", "超时", "运行出错"}
	AllResults    = []string{"通过", "答案错误", "超时", "运行出错", "思路不成立"}
	ValidScopes   = []string{"full", "quick", "sample", "custom"}
	ValidLabels   = []string{"通过", "未通过", "未验证"}
	ScopeLabel    = map[string]string{"full": "全量测试", "quick": "精简测试", "sample": "运行示例", "custom": "自定义用例"}

	commentLineRe = regexp.MustCompile(`^\s*(#|//|/\*|\*/|\*(\s|$))`)
	wsRe          = regexp.MustCompile(`\s+`)
	backtickRunRe = regexp.MustCompile("`+")
	attemptPathRe = regexp.MustCompile(`^attempts/(\d{4})\.([^/]+)/(\d{4}-\d{2}-\d{2})\.(\d+)\.([^./]+)\.md$`)
)

type ProblemMeta struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug,omitempty"`
}

type ProgressEntry struct {
	Status    string `json:"status"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

type ProgressFile struct {
	Version  int                      `json:"version"`
	Problems map[string]ProgressEntry `json:"problems"`
}

type SettingsFile struct {
	Version int      `json:"version"`
	Langs   []string `json:"langs"`
}

type ValidationError struct {
	Message string
	Status  int
}

func (e *ValidationError) Error() string { return e.Message }

type PracticeSave struct {
	Kind     string   `json:"kind"` // "draft" | "run" | "solution"
	ID       int      `json:"id"`
	Lang     string   `json:"lang"`
	Mode     string   `json:"mode"` // "leetcode" | "acm"
	Code     string   `json:"code"`
	Label    string   `json:"label,omitempty"`
	Result   string   `json:"result,omitempty"`
	Passed   int      `json:"passed,omitempty"`
	Total    int      `json:"total,omitempty"`
	Duration int      `json:"duration,omitempty"`
	Notes    []string `json:"notes,omitempty"`
	Scope    string   `json:"scope,omitempty"`
	Manual   bool     `json:"manual,omitempty"`
}

type FileWrite struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type SavePlan struct {
	Files    []FileWrite
	Message  string
	Attempt  string
	Solution string
	Draft    string
	Status   string
}

func Pad4(id int) string {
	return fmt.Sprintf("%04d", id)
}

func TidyCode(code string) string {
	s := strings.ReplaceAll(code, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	s = strings.TrimRight(s, " \t\n")
	return s + "\n"
}

// CodeKey computes a whitespace- and comment-insensitive fingerprint identical to site/lib/sync/core.ts.
func CodeKey(code string) string {
	s := strings.ReplaceAll(code, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	lines := strings.Split(strings.TrimSpace(s), "\n")
	var kept []string
	for _, line := range lines {
		line = strings.TrimRight(line, " \t")
		if commentLineRe.MatchString(line) {
			continue
		}
		kept = append(kept, line)
	}
	return wsRe.ReplaceAllString(strings.Join(kept, ""), "")
}

// GitBlobSHA computes sha1("blob <byte_len>\0" + content), matching git hash-object.
func GitBlobSHA(content string) string {
	body := []byte(content)
	h := sha1.New()
	fmt.Fprintf(h, "blob %d\x00", len(body))
	h.Write(body)
	return hex.EncodeToString(h.Sum(nil))
}

func Fence(code string) string {
	maxRun := 2
	for _, m := range backtickRunRe.FindAllString(code, -1) {
		if len(m) > maxRun {
			maxRun = len(m)
		}
	}
	return strings.Repeat("`", maxRun+1)
}

// BeijingParts returns YYYY-MM-DD and HH:MM:SS in UTC+8 (Beijing time).
func BeijingParts(now time.Time) (dateStr, timeStr string) {
	bj := now.In(time.FixedZone("CST", 8*3600))
	return bj.Format("2006-01-02"), bj.Format("15:04:05")
}

func CleanLangs(langs []string) []string {
	var out []string
	for _, l := range langs {
		if _, ok := PracticeExt[l]; ok && !slices.Contains(out, l) {
			out = append(out, l)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// NextStatus implements the monotonic non-decreasing status rule from site/lib/sync/core.ts.
func NextStatus(cur *ProgressEntry, result, bjDate string) *ProgressEntry {
	curStatus := "未开始"
	curUpdated := ""
	if cur != nil && cur.Status != "" {
		curStatus = cur.Status
		curUpdated = cur.UpdatedAt
	}
	if curStatus == "已通过" {
		return nil
	}
	if curStatus == "曾通过" {
		if result == "通过" && curUpdated != "" && bjDate > curUpdated {
			return &ProgressEntry{Status: "已通过", UpdatedAt: bjDate}
		}
		return nil
	}
	if result == "通过" {
		return &ProgressEntry{Status: "已通过", UpdatedAt: bjDate}
	}
	if curStatus == "尝试过" {
		return nil
	}
	return &ProgressEntry{Status: "尝试过", UpdatedAt: bjDate}
}

func WriteProgressJSON(existing map[string]ProgressEntry) string {
	keys := make([]int, 0, len(existing))
	for k := range existing {
		if id, err := strconv.Atoi(k); err == nil {
			keys = append(keys, id)
		}
	}
	sort.Ints(keys)
	var b strings.Builder
	b.WriteString("{\n  \"version\": 1,\n  \"problems\": {")
	for i, id := range keys {
		k := strconv.Itoa(id)
		entry := existing[k]
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString("\n    ")
		keyJSON, _ := json.Marshal(k)
		valJSON, _ := json.Marshal(entry)
		b.Write(keyJSON)
		b.WriteString(": ")
		b.Write(valJSON)
	}
	if len(keys) > 0 {
		b.WriteString("\n  }\n}\n")
	} else {
		b.WriteString("}\n}\n")
	}
	return b.String()
}

func WriteSettingsJSON(langs []string) string {
	raw, _ := json.MarshalIndent(SettingsFile{Version: 1, Langs: langs}, "", "  ")
	return string(raw) + "\n"
}

func DraftPath(p ProblemMeta, lang, mode string) string {
	variant := ""
	if mode == "acm" {
		variant = ".ACM"
	}
	return fmt.Sprintf("drafts/%s/%s.%s%s%s", lang, Pad4(p.ID), p.Name, variant, PracticeExt[lang])
}

func SolutionBasePath(p ProblemMeta, lang, mode string) string {
	variant := ""
	if mode == "acm" {
		variant = ".ACM"
	}
	return fmt.Sprintf("solutions/%s/%s.%s%s%s", lang, Pad4(p.ID), p.Name, variant, PracticeExt[lang])
}

func ParseAttemptPath(path string) (id int, date string, seq int, result string, ok bool) {
	m := attemptPathRe.FindStringSubmatch(path)
	if m == nil || !slices.Contains(AllResults, m[5]) {
		return 0, "", 0, "", false
	}
	id, _ = strconv.Atoi(m[1])
	seq, _ = strconv.Atoi(m[4])
	return id, m[3], seq, m[5], true
}

func oneLine(s string) string {
	t := strings.TrimSpace(wsRe.ReplaceAllString(s, " "))
	t = strings.TrimLeft(t, "# ")
	runes := []rune(t)
	if len(runes) > 400 {
		return string(runes[:399]) + "…"
	}
	return t
}

func ValidatePracticeSave(raw []byte) (*PracticeSave, error) {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil || m == nil {
		return nil, &ValidationError{Message: "参数不对：JSON", Status: 400}
	}
	kind, _ := m["kind"].(string)
	if kind != "draft" && kind != "run" && kind != "solution" {
		return nil, &ValidationError{Message: "参数不对：kind", Status: 400}
	}
	idFloat, idOK := m["id"].(float64)
	id := int(idFloat)
	if !idOK || math.Trunc(idFloat) != idFloat || id < 1 || id > 9999 {
		return nil, &ValidationError{Message: "参数不对：id", Status: 400}
	}
	lang, _ := m["lang"].(string)
	if _, ok := PracticeExt[lang]; !ok {
		return nil, &ValidationError{Message: "参数不对：lang", Status: 400}
	}
	mode, _ := m["mode"].(string)
	if mode != "leetcode" && mode != "acm" {
		return nil, &ValidationError{Message: "参数不对：mode", Status: 400}
	}
	code, codeOK := m["code"].(string)
	if !codeOK || strings.TrimSpace(code) == "" {
		return nil, &ValidationError{Message: "参数不对：code", Status: 400}
	}
	if len([]rune(code)) > 100000 {
		return nil, &ValidationError{Message: "代码太长了（最多 100 KB）", Status: 400}
	}

	out := &PracticeSave{Kind: kind, ID: id, Lang: lang, Mode: mode, Code: code}
	if kind == "draft" {
		return out, nil
	}
	if kind == "solution" {
		lbl, _ := m["label"].(string)
		if !slices.Contains(ValidLabels, lbl) {
			return nil, &ValidationError{Message: "参数不对：label", Status: 400}
		}
		out.Label = lbl
		return out, nil
	}

	res, _ := m["result"].(string)
	if !slices.Contains(ValidResults, res) {
		return nil, &ValidationError{Message: "参数不对：result", Status: 400}
	}
	passedF, pOK := m["passed"].(float64)
	totalF, tOK := m["total"].(float64)
	passed, total := int(passedF), int(totalF)
	if !pOK || !tOK || total < 1 || total > 1000 || passed < 0 || passed > total {
		return nil, &ValidationError{Message: "参数不对：passed / total", Status: 400}
	}
	if (res == "通过") != (passed == total) {
		return nil, &ValidationError{Message: "参数不对：全部通过才记「通过」", Status: 400}
	}
	scope := "full"
	if rawScope, hasScope := m["scope"]; hasScope && rawScope != nil {
		scope, _ = rawScope.(string)
	}
	if !slices.Contains(ValidScopes, scope) {
		return nil, &ValidationError{Message: "参数不对：scope", Status: 400}
	}
	if scope != "full" && res == "通过" {
		return nil, &ValidationError{Message: "参数不对：只有全量测试全部通过才记「通过」", Status: 400}
	}
	dur := 0
	if df, ok := m["duration"].(float64); ok && df >= 0 && !math.IsNaN(df) && !math.IsInf(df, 0) {
		dur = int(math.Round(df))
	}
	var notes []string
	if rawNotes, ok := m["notes"].([]any); ok {
		for _, item := range rawNotes {
			if len(notes) >= 5 {
				break
			}
			if s, ok := item.(string); ok {
				cleaned := oneLine(s)
				if cleaned != "" {
					notes = append(notes, cleaned)
				}
			}
		}
	}
	manual, _ := m["manual"].(bool)
	out.Result = res
	out.Passed = passed
	out.Total = total
	out.Duration = dur
	out.Notes = notes
	out.Scope = scope
	out.Manual = manual
	return out, nil
}

func RenderPracticeAttempt(s PracticeSave, dateStr, timeStr string) string {
	code := strings.TrimSuffix(TidyCode(s.Code), "\n")
	f := Fence(code)
	head := fmt.Sprintf("%s：通过 %d / %d 个用例", s.Result, s.Passed, s.Total)
	if s.Result == "通过" {
		head = fmt.Sprintf("全部通过（%d 个用例）", s.Total)
	}
	manualTxt := ""
	if s.Manual {
		manualTxt = "，手动保存"
	}
	how := fmt.Sprintf("网站练习区「%s」%s", ScopeLabel[s.Scope], manualTxt)
	modeTxt := "力扣模式"
	if s.Mode == "acm" {
		modeTxt = "ACM 模式"
	}
	durTxt := ""
	if s.Duration > 0 {
		durTxt = fmt.Sprintf(" · 用时 %d ms", s.Duration)
	}
	lines := []string{
		"---",
		fmt.Sprintf("lang: %s", s.Lang),
		"verbatim: true",
		"source: practice",
		fmt.Sprintf("mode: %s", s.Mode),
		fmt.Sprintf("ranAt: %sT%s+08:00", dateStr, timeStr),
		"---",
		"",
		"## 代码",
		"",
		f + s.Lang,
		code,
		f,
		"",
		"## 测试结果",
		"",
		fmt.Sprintf("%s，%s · %s%s", how, modeTxt, head, durTxt),
	}
	if len(s.Notes) > 0 {
		lines = append(lines, "")
		for _, n := range s.Notes {
			lines = append(lines, "- "+n)
		}
	}
	lines = append(lines, "", "用例是本站的判题用例，结果不代表力扣的判题。", "")
	return strings.Join(lines, "\n")
}

func PickSolutionPath(p ProblemMeta, lang, mode, code, label string, existingPaths []string, existingSolutions map[string]string) string {
	ext := PracticeExt[lang]
	prefix := fmt.Sprintf("solutions/%s/%s.", lang, Pad4(p.ID))
	wantKey := CodeKey(code)
	taken := make(map[string]struct{}, len(existingPaths))
	for _, path := range existingPaths {
		taken[path] = struct{}{}
		if strings.HasPrefix(path, prefix) && strings.HasSuffix(path, ext) {
			if src, ok := existingSolutions[path]; ok && CodeKey(src) == wantKey {
				return ""
			}
		}
	}
	if label == "" || label == "通过" {
		base := SolutionBasePath(p, lang, mode)
		if _, exists := taken[base]; !exists {
			return base
		}
		acmTag := ""
		if mode == "acm" {
			acmTag = "ACM"
		}
		for n := 2; ; n++ {
			cand := fmt.Sprintf("solutions/%s/%s.%s.%s%d%s", lang, Pad4(p.ID), p.Name, acmTag, n, ext)
			if _, exists := taken[cand]; !exists {
				return cand
			}
		}
	}
	acmPrefix := ""
	if mode == "acm" {
		acmPrefix = "ACM"
	}
	tag := acmPrefix + label
	for n := 1; ; n++ {
		suffix := ""
		if n > 1 {
			suffix = strconv.Itoa(n)
		}
		cand := fmt.Sprintf("solutions/%s/%s.%s.%s%s%s", lang, Pad4(p.ID), p.Name, tag, suffix, ext)
		if _, exists := taken[cand]; !exists {
			return cand
		}
	}
}

type PlanContext struct {
	Problem           ProblemMeta
	ExistingPaths     []string
	Progress          map[string]ProgressEntry
	ExistingSolutions map[string]string
	Now               time.Time
}

func PlanPracticeSave(s PracticeSave, ctx PlanContext) (SavePlan, error) {
	if ctx.Problem.ID == 0 || ctx.Problem.Name == "" {
		return SavePlan{}, errors.New("缺少题目元信息")
	}
	acmSuffix := ""
	if s.Mode == "acm" {
		acmSuffix = "（ACM）"
	}
	what := fmt.Sprintf("第 %d 题 %s · %s%s", ctx.Problem.ID, ctx.Problem.Name, LangLabel[s.Lang], acmSuffix)

	if s.Kind == "draft" {
		dp := DraftPath(ctx.Problem, s.Lang, s.Mode)
		return SavePlan{
			Files:   []FileWrite{{Path: dp, Content: TidyCode(s.Code)}},
			Message: "练习草稿：" + what,
			Draft:   dp,
		}, nil
	}
	if s.Kind == "solution" {
		sol := PickSolutionPath(ctx.Problem, s.Lang, s.Mode, s.Code, s.Label, ctx.ExistingPaths, ctx.ExistingSolutions)
		var files []FileWrite
		if sol != "" {
			files = append(files, FileWrite{Path: sol, Content: TidyCode(s.Code)})
		}
		return SavePlan{
			Files:    files,
			Message:  fmt.Sprintf("练习：%s · 存为我的题解（%s）", what, s.Label),
			Solution: sol,
		}, nil
	}

	dateStr, timeStr := BeijingParts(ctx.Now)
	maxSeq := 0
	for _, p := range ctx.ExistingPaths {
		if pid, d, seq, _, ok := ParseAttemptPath(p); ok && pid == ctx.Problem.ID && d == dateStr && seq > maxSeq {
			maxSeq = seq
		}
	}
	attPath := fmt.Sprintf("attempts/%s.%s/%s.%d.%s.md", Pad4(ctx.Problem.ID), ctx.Problem.Name, dateStr, maxSeq+1, s.Result)
	files := []FileWrite{{Path: attPath, Content: RenderPracticeAttempt(s, dateStr, timeStr)}}

	var solPath string
	if s.Result == "通过" {
		solPath = PickSolutionPath(ctx.Problem, s.Lang, s.Mode, s.Code, "通过", ctx.ExistingPaths, ctx.ExistingSolutions)
		if solPath != "" {
			files = append(files, FileWrite{Path: solPath, Content: TidyCode(s.Code)})
		}
	}

	progMap := make(map[string]ProgressEntry, len(ctx.Progress)+1)
	for k, v := range ctx.Progress {
		progMap[k] = v
	}
	var curPtr *ProgressEntry
	if cur, exists := progMap[strconv.Itoa(ctx.Problem.ID)]; exists {
		curPtr = &cur
	}
	var newStatus string
	if next := NextStatus(curPtr, s.Result, dateStr); next != nil {
		progMap[strconv.Itoa(ctx.Problem.ID)] = *next
		files = append(files, FileWrite{Path: "progress.json", Content: WriteProgressJSON(progMap)})
		newStatus = next.Status
	}

	scopeTxt := ""
	if s.Scope != "full" {
		scopeTxt = " · " + ScopeLabel[s.Scope]
	}
	manualTxt := ""
	if s.Manual {
		manualTxt = " · 手动保存"
	}
	msg := fmt.Sprintf("练习：%s · %s（%d/%d）%s%s", what, s.Result, s.Passed, s.Total, scopeTxt, manualTxt)
	return SavePlan{
		Files:    files,
		Message:  msg,
		Attempt:  attPath,
		Solution: solPath,
		Status:   newStatus,
	}, nil
}
