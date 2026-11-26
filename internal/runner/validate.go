package runner

import (
	"bytes"
	"encoding/json"
	"slices"
	"strings"
)

var (
	Langs      = []string{"python", "java", "cpp", "go", "javascript", "typescript", "c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"}
	DebugLangs = []string{"java", "cpp", "go"}
	Features   = []string{"ts-transform", "dap-ws", "otel-metrics"}
)

type Job struct {
	Lang  string          `json:"lang"`
	Mode  string          `json:"mode"`
	Code  string          `json:"code"`
	Sig   json.RawMessage `json:"sig,omitempty"`
	Cases []JobCase       `json:"cases"`
	Debug bool            `json:"debug"`
}

type JobCase struct {
	Input json.RawMessage `json:"input,omitempty"`
	Stdin *string         `json:"stdin,omitempty"`
}

type SandboxTask struct {
	Lang   string          `json:"lang"`
	Mode   string          `json:"mode"`
	Code   string          `json:"code"`
	Sig    json.RawMessage `json:"sig,omitempty"`
	Cases  []SandboxCase   `json:"cases"`
	Debug  bool            `json:"debug"`
	Limits TaskLimits      `json:"limits"`
}

type SandboxCase struct {
	Input json.RawMessage `json:"input,omitempty"`
	Stdin *string         `json:"stdin,omitempty"`
}

type TaskLimits struct {
	CaseMs  int `json:"caseMs"`
	TotalMs int `json:"totalMs"`
	Steps   int `json:"steps"`
}

// ParseAndValidateJob parses raw request JSON and enforces identical rules and Chinese error messages to server.mjs.
func ParseAndValidateJob(raw []byte) (*Job, string, bool) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil, "请求体不是合法的 JSON", false
	}
	var generic any
	if err := json.Unmarshal(trimmed, &generic); err != nil {
		return nil, "请求体不是合法的 JSON", false
	}
	obj, ok := generic.(map[string]any)
	if !ok || obj == nil {
		return nil, "请求体要是一个 JSON 对象", true
	}

	lang, _ := obj["lang"].(string)
	if !slices.Contains(Langs, lang) {
		return nil, "不支持的语言", true
	}
	mode, _ := obj["mode"].(string)
	if mode != "leetcode" && mode != "acm" {
		return nil, "模式只能是 leetcode 或 acm", true
	}
	code, ok := obj["code"].(string)
	if !ok || strings.TrimSpace(code) == "" {
		return nil, "代码是空的", true
	}
	if len([]rune(code)) > 100000 || len(code) > 400000 {
		return nil, "代码不能超过 100 KB", true
	}
	rawCases, ok := obj["cases"].([]any)
	if !ok || len(rawCases) == 0 {
		return nil, "至少要有一组用例", true
	}
	if len(rawCases) > 100 {
		return nil, "一次最多 100 组用例", true
	}
	debug, _ := obj["debug"].(bool)
	if debug && !slices.Contains(DebugLangs, lang) {
		return nil, "这门语言不能在云端调试", true
	}
	if debug && len(rawCases) != 1 {
		return nil, "调试一次只跑一组用例", true
	}
	if mode == "leetcode" {
		sigMap, sigOK := obj["sig"].(map[string]any)
		if !sigOK || sigMap == nil {
			return nil, "力扣模式要有函数签名", true
		}
	}
	for _, rc := range rawCases {
		cm, ok := rc.(map[string]any)
		if !ok || cm == nil {
			return nil, "用例格式不对", true
		}
		if mode == "leetcode" {
			if _, arrOK := cm["input"].([]any); !arrOK {
				return nil, "力扣模式的用例要有 input", true
			}
		}
		if mode == "acm" {
			if _, strOK := cm["stdin"].(string); !strOK {
				return nil, "ACM 模式的用例要有 stdin", true
			}
		}
	}

	var job Job
	if err := json.Unmarshal(trimmed, &job); err != nil {
		return nil, "请求体不是合法的 JSON", false
	}
	return &job, "", true
}
