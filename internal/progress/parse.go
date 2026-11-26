package progress

import (
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

var (
	solutionPathRe   = regexp.MustCompile(`^solutions/([a-z]+)/(\d{4})\.(.+)(\.[A-Za-z0-9]+)$`)
	draftPathRe      = regexp.MustCompile(`^drafts/([a-z]+)/(\d{4})\.(.+)(\.[A-Za-z0-9]+)$`)
	langExtensions   = map[string][]string{
		"python": {".py"}, "java": {".java"}, "go": {".go"}, "cpp": {".cpp", ".cc"}, "c": {".c"},
		"javascript": {".js"}, "typescript": {".ts"}, "rust": {".rs"}, "kotlin": {".kt"}, "swift": {".swift"},
		"csharp": {".cs"}, "ruby": {".rb"}, "php": {".php"}, "scala": {".scala"}, "dart": {".dart"},
	}
	javaSubmitRegionRe = regexp.MustCompile(`(?i)//[^\n]*?submit (?:code )?region begin[^\n]*\n([\s\S]*?)//[^\n]*?submit (?:code )?region end`)
	fmKVRe             = regexp.MustCompile(`^([A-Za-z]+):\s*(.*?)\s*(?:#.*)?$`)
	digitsOnlyRe       = regexp.MustCompile(`^\d+$`)
	isoOffsetTimeRe    = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$`)
	sha1HexRe          = regexp.MustCompile(`^[0-9a-f]{40}$`)
	yyyyMmDdRe         = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	headingSplitRe     = regexp.MustCompile(`(?m)^## +`)
)

// HistoryFile matches site/lib/types.ts HistoryFile.
type HistoryFile struct {
	Lang  string `json:"lang"`
	Label string `json:"label"`
	File  string `json:"file"`
	Code  string `json:"code"`
}

// AttemptSection matches a non-code markdown section in site/lib/types.ts Attempt.
type AttemptSection struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

// Attempt matches site/lib/types.ts Attempt.
type Attempt struct {
	File        string           `json:"file"`
	Date        string           `json:"date"`
	Seq         int              `json:"seq"`
	Result      string           `json:"result"`
	Lang        string           `json:"lang"`
	Verbatim    bool             `json:"verbatim"`
	Sections    []AttemptSection `json:"sections"`
	Code        *string          `json:"code"`
	Errors      []string         `json:"errors"`
	Source      *string          `json:"source"`
	Submission  *string          `json:"submission"`
	SubmittedAt *string          `json:"submittedAt"`
}

func LangOrder() []string {
	return []string{"python", "java", "go", "cpp", "c", "javascript", "typescript", "rust", "kotlin", "swift", "csharp", "ruby", "php", "scala", "dart"}
}

func ParseSolutionPath(p string) (id int, lang, variant string, ok bool) {
	m := solutionPathRe.FindStringSubmatch(p)
	if m == nil {
		return 0, "", "", false
	}
	exts, exists := langExtensions[m[1]]
	if !exists || !slices.Contains(exts, m[4]) {
		return 0, "", "", false
	}
	id, err := strconv.Atoi(m[2])
	if err != nil {
		return 0, "", "", false
	}
	rest := m[3]
	if dot := strings.IndexByte(rest, '.'); dot >= 0 {
		variant = rest[dot+1:]
	}
	return id, m[1], variant, true
}

func ParseDraftPath(p string) (id int, lang, mode string, ok bool) {
	m := draftPathRe.FindStringSubmatch(p)
	if m == nil {
		return 0, "", "", false
	}
	exts, exists := langExtensions[m[1]]
	if !exists || !slices.Contains(exts, m[4]) {
		return 0, "", "", false
	}
	id, err := strconv.Atoi(m[2])
	if err != nil {
		return 0, "", "", false
	}
	mode = "leetcode"
	if strings.HasSuffix(m[3], ".ACM") {
		mode = "acm"
	}
	return id, m[1], mode, true
}

func TrimSolution(lang, src string) string {
	s := strings.ReplaceAll(src, "\r\n", "\n")
	if lang == "java" {
		matches := javaSubmitRegionRe.FindAllStringSubmatch(s, -1)
		if len(matches) > 0 {
			parts := make([]string, 0, len(matches))
			for _, m := range matches {
				parts = append(parts, strings.TrimRight(m[1], " \t\n\r"))
			}
			return strings.Join(parts, "\n\n")
		}
	}
	return strings.TrimRight(s, " \t\n\r")
}

func ParseAttemptBody(src string) (lang string, verbatim bool, sections []AttemptSection, code *string, errorsOut []string, source, submission, submittedAt *string) {
	text := strings.TrimPrefix(src, "\uFEFF")
	text = strings.ReplaceAll(text, "\r\n", "\n")
	errorsOut = []string{}
	sections = []AttemptSection{}

	var fmContent string
	hasFM := false
	body := text
	if strings.HasPrefix(text, "---\n") {
		if idx := strings.Index(text[4:], "\n---\n"); idx >= 0 {
			hasFM = true
			fmContent = text[4 : 4+idx]
			body = text[4+idx+5:]
		}
	}

	meta := make(map[string]string)
	if !hasFM {
		errorsOut = append(errorsOut, "开头要有 --- 包起来的设置（至少写 lang）")
	} else {
		for _, line := range strings.Split(fmContent, "\n") {
			tr := strings.TrimSpace(line)
			if tr == "" || strings.HasPrefix(tr, "#") {
				continue
			}
			m := fmKVRe.FindStringSubmatch(line)
			if m == nil {
				errorsOut = append(errorsOut, "设置里看不懂这一行："+line)
				continue
			}
			meta[m[1]] = m[2]
		}
	}

	lang = meta["lang"]
	if hasFM {
		if _, ok := langExtensions[lang]; !ok {
			errorsOut = append(errorsOut, "lang 要写成语言目录名之一")
		}
	}
	if v, has := meta["verbatim"]; has && v != "true" && v != "false" {
		errorsOut = append(errorsOut, "verbatim 只能写 true 或 false")
	}
	verbatim = meta["verbatim"] != "false"

	chunks := headingSplitRe.Split(body, -1)
	for _, chunk := range chunks[1:] {
		var title, content string
		if nl := strings.IndexByte(chunk, '\n'); nl >= 0 {
			title = strings.TrimSpace(chunk[:nl])
			content = strings.TrimSpace(chunk[nl+1:])
		} else {
			title = strings.TrimSpace(chunk)
		}
		if title == "代码" {
			extracted, ok := extractFencedCode(content)
			if !ok {
				errorsOut = append(errorsOut, "「代码」一节里要放且只放一个 ``` 代码块")
			} else {
				code = &extracted
			}
		} else {
			sections = append(sections, AttemptSection{Title: title, Text: content})
		}
	}
	_ = hasFM

	if sub, has := meta["submission"]; has && !digitsOnlyRe.MatchString(sub) {
		errorsOut = append(errorsOut, "submission 只能写力扣的提交编号（数字）")
	}
	if sa, has := meta["submittedAt"]; has && !isoOffsetTimeRe.MatchString(sa) {
		errorsOut = append(errorsOut, "submittedAt 要写成 2026-11-14T10:05:00+08:00 这样")
	}
	if md, has := meta["mode"]; has && md != "leetcode" && md != "acm" {
		errorsOut = append(errorsOut, "mode 只能写 leetcode 或 acm")
	}
	if ra, has := meta["ranAt"]; has && !isoOffsetTimeRe.MatchString(ra) {
		errorsOut = append(errorsOut, "ranAt 要写成 2026-11-17T23:30:00+08:00 这样")
	}
	if s := meta["source"]; s != "" {
		source = &s
	}
	if sub := meta["submission"]; digitsOnlyRe.MatchString(sub) {
		submission = &sub
	}
	if sa := meta["submittedAt"]; sa != "" {
		submittedAt = &sa
	} else if ra := meta["ranAt"]; isoOffsetTimeRe.MatchString(ra) {
		submittedAt = &ra
	}
	return lang, verbatim, sections, code, errorsOut, source, submission, submittedAt
}

func extractFencedCode(content string) (string, bool) {
	nl := strings.IndexByte(content, '\n')
	if nl < 0 {
		return "", false
	}
	open := content[:nl]
	ticks := 0
	for ticks < len(open) && open[ticks] == '`' {
		ticks++
	}
	if ticks < 3 || strings.ContainsRune(open[ticks:], '`') {
		return "", false
	}
	fenceStr := strings.Repeat("`", ticks)
	rest := content[nl+1:]
	trimmedRest := strings.TrimRight(rest, " \t\n\r")
	if !strings.HasSuffix(trimmedRest, "\n"+fenceStr) {
		return "", false
	}
	inner := strings.TrimSuffix(trimmedRest, "\n"+fenceStr)
	return inner, true
}

func ParseAttemptFull(filePath, src string) (Attempt, bool) {
	id, date, seq, result, ok := ParseAttemptPath(filePath)
	if !ok || id <= 0 {
		return Attempt{}, false
	}
	lang, verbatim, sections, code, errs, source, sub, at := ParseAttemptBody(src)
	return Attempt{
		File:        filePath,
		Date:        date,
		Seq:         seq,
		Result:      result,
		Lang:        lang,
		Verbatim:    verbatim,
		Sections:    sections,
		Code:        code,
		Errors:      errs,
		Source:      source,
		Submission:  sub,
		SubmittedAt: at,
	}, true
}

// SyncWriteRequest validates /api/sync/commit payloads identically to site/lib/sync/server.ts.
type SyncWriteRequest struct {
	Branch   string      `json:"branch"`
	Parent   string      `json:"parent"`
	BaseTree string      `json:"baseTree"`
	Files    []FileWrite `json:"files"`
	Message  string      `json:"message"`
}

const (
	maxSyncFiles = 600
	maxSyncFile  = 200_000
	maxSyncTotal = 4_000_000
)

func ValidateSyncWrites(raw []byte) (*SyncWriteRequest, error) {
	var req SyncWriteRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return nil, &ValidationError{Message: "参数不对：JSON", Status: 400}
	}
	if req.Branch == "" || len(req.Branch) > 200 {
		return nil, &ValidationError{Message: "参数不对：branch", Status: 400}
	}
	if !sha1HexRe.MatchString(req.Parent) || !sha1HexRe.MatchString(req.BaseTree) {
		return nil, &ValidationError{Message: "参数不对：parent / baseTree", Status: 400}
	}
	if req.Message == "" || len(req.Message) > 20_000 {
		return nil, &ValidationError{Message: "参数不对：message", Status: 400}
	}
	if len(req.Files) == 0 || len(req.Files) > maxSyncFiles {
		return nil, &ValidationError{Message: fmt.Sprintf("一次最多写 %d 个文件", maxSyncFiles), Status: 400}
	}
	seen := make(map[string]struct{}, len(req.Files))
	total := 0
	for _, f := range req.Files {
		if _, dup := seen[f.Path]; dup {
			return nil, &ValidationError{Message: f.Path + " 出现了两次", Status: 400}
		}
		seen[f.Path] = struct{}{}
		if len(f.Content) > maxSyncFile {
			return nil, &ValidationError{Message: f.Path + " 太大了", Status: 400}
		}
		total += len(f.Content)
		switch {
		case f.Path == "progress.json":
			var pf ProgressFile
			if err := json.Unmarshal([]byte(f.Content), &pf); err != nil || pf.Version != 1 || pf.Problems == nil {
				return nil, &ValidationError{Message: "progress.json 的结构不对", Status: 400}
			}
			for k, v := range pf.Problems {
				if !digitsOnlyRe.MatchString(k) || !slices.Contains(ValidStatuses, v.Status) || (v.UpdatedAt != "" && !yyyyMmDdRe.MatchString(v.UpdatedAt)) {
					return nil, &ValidationError{Message: fmt.Sprintf("progress.json 第 %s 题的内容不对", k), Status: 400}
				}
			}
		case f.Path == "attempts/skip.txt":
			for _, line := range strings.Split(strings.TrimPrefix(f.Content, "\uFEFF"), "\n") {
				tr := strings.TrimSpace(line)
				if tr == "" || strings.HasPrefix(tr, "#") {
					continue
				}
				if !digitsOnlyRe.MatchString(tr) {
					return nil, &ValidationError{Message: "attempts/skip.txt 里只能写提交编号", Status: 400}
				}
			}
		default:
			if _, _, _, _, ok := ParseAttemptPath(f.Path); !ok {
				return nil, &ValidationError{Message: "同步不能写 " + f.Path, Status: 400}
			}
			_, _, _, _, errs, _, _, _ := ParseAttemptBody(f.Content)
			if len(errs) > 0 {
				return nil, &ValidationError{Message: fmt.Sprintf("%s：%s", f.Path, errs[0]), Status: 400}
			}
		}
	}
	if total > maxSyncTotal {
		return nil, &ValidationError{Message: "这次要写的内容太多了，分几次同步", Status: 400}
	}
	return &req, nil
}
