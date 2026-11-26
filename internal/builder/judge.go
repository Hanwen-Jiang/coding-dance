package builder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/conc"
)

var AllJudgeLangs = []string{"python", "java", "cpp", "go", "javascript", "typescript"}

type JudgeOptions struct {
	Langs   []string
	Require bool
	Targets []string
	Workers int
}

type judgeCase struct {
	In  any `json:"in"`
	Out any `json:"out"`
}

type judgeUnit struct {
	Name   string
	Label  string
	Sig    RawSignature
	Norm   NormSignature
	Codes  []judgeCode
	Cases  []any
	Expect []any
}

type judgeCode struct {
	Key  string
	T    string
	Code map[string]string
}

type judgeJob struct {
	Name   string
	Label  string
	Sig    NormSignature
	Cases  []any
	Expect []any
	Code   string
}

type judgeResult struct {
	Error   string
	Outputs []any
}

type judgeDataEntry struct {
	T     string                 `json:"t"`
	Key   string                 `json:"key"`
	Judge *bool                  `json:"judge"`
	Code  string                 `json:"code"`
	Langs map[string]ParsedCode  `json:"langs"`
}

type judgeIllFile struct {
	ID    int              `json:"id"`
	Name  string           `json:"name"`
	Sig   RawSignature     `json:"sig"`
	Codes []judgeDataEntry `json:"codes"`
}

type judgeTopicFile struct {
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	Sections []struct {
		Key   string           `json:"key"`
		T     string           `json:"t"`
		Codes []judgeDataEntry `json:"codes"`
	} `json:"sections"`
}

type judgeCasesFile struct {
	Sig   RawSignature `json:"sig"`
	Fixed int          `json:"fixed"`
	Cases []judgeCase  `json:"cases"`
}

func pythonCmdParts() []string {
	if v := strings.TrimSpace(os.Getenv("PYTHON")); v != "" {
		return strings.Fields(v)
	}
	if runtime.GOOS == "windows" {
		return []string{"python"}
	}
	return []string{"python3"}
}

func hasToolCmd(name string, args ...string) bool {
	cmd := exec.Command(name, args...)
	return cmd.Run() == nil
}

func parseOutputLines(stdout string, n int, extraErr string) []any {
	var lines []string
	for _, line := range strings.Split(strings.ReplaceAll(stdout, "\r\n", "\n"), "\n") {
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	out := make([]any, n)
	for i := 0; i < n; i++ {
		if i >= len(lines) {
			msg := extraErr
			if msg == "" {
				msg = "没有输出（程序提前退出了）"
			}
			out[i] = map[string]any{"__error": msg}
			continue
		}
		v, err := DecodeJSONValue(lines[i])
		if err != nil {
			s := lines[i]
			if len(s) > 200 {
				s = s[:200]
			}
			out[i] = map[string]any{"__error": "输出不是 JSON：" + s}
			continue
		}
		out[i] = v
	}
	return out
}

func lastNonEmptyLine(s string) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	if len(lines) == 0 {
		return ""
	}
	return strings.TrimSpace(lines[len(lines)-1])
}

func firstNLines(s string, n int) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	if len(lines) > n {
		lines = lines[:n]
	}
	return strings.Join(lines, " | ")
}

func runCommandCapture(ctx context.Context, cwd string, timeout time.Duration, name string, args ...string) (string, string, error, bool) {
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(cctx, name, args...)
	cmd.Dir = cwd
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	timedOut := cctx.Err() == context.DeadlineExceeded
	return stdout.String(), stderr.String(), err, timedOut
}

// RunPythonCasesSync executes Python reference solution against input cases using judge/prelude/runner.py.
func RunPythonCasesSync(ctx context.Context, repoRoot, name string, sig NormSignature, cases []any, pyCode string) ([]any, error) {
	prelude, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "pytest_prelude.py"))
	if err != nil {
		return nil, err
	}
	runnerPy, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "judge", "prelude", "runner.py"))
	if err != nil {
		return nil, err
	}
	tmpDir, err := os.MkdirTemp("", "cd-py-judge-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	var nodeDef string
	if UsesType(sig, "RandomList") {
		nodeDef = "\nclass Node:\n    def __init__(self, x: int, next: 'Node' = None, random: 'Node' = None):\n        self.val = int(x)\n        self.next = next\n        self.random = random\n"
	}
	pyPath := filepath.Join(tmpDir, name+".py")
	jsonPath := filepath.Join(tmpDir, name+".json")
	if err := os.WriteFile(pyPath, []byte(string(prelude)+nodeDef+"\n"+pyCode+"\n"+string(runnerPy)), 0o644); err != nil {
		return nil, err
	}
	payload, err := MarshalJSONNoEscape(map[string]any{
		"sig":   FlatSigMap(sig),
		"cases": cases,
	})
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(jsonPath, payload, 0o644); err != nil {
		return nil, err
	}
	pyCmd := pythonCmdParts()
	stdout, stderr, _, timedOut := runCommandCapture(ctx, tmpDir, 60*time.Second, pyCmd[0], append(pyCmd[1:], pyPath, jsonPath)...)
	extra := lastNonEmptyLine(stderr)
	if timedOut {
		extra = "超时"
	}
	return parseOutputLines(stdout, len(cases), extra), nil
}

func collectJudgeUnits(repoRoot string, targets []string) ([]judgeUnit, error) {
	want := func(name string) bool {
		return len(targets) == 0 || slices.Contains(targets, name)
	}
	dataDir := filepath.Join(repoRoot, "tools", "illustrations", "data")
	casesDir := filepath.Join(repoRoot, "tools", "illustrations", "cases")
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return nil, fmt.Errorf("读取 %s 失败（请先运行 cd-build build）: %w", dataDir, err)
	}

	var probFiles []string
	for _, e := range entries {
		if !e.IsDir() && len(e.Name()) == 9 && strings.HasSuffix(e.Name(), ".json") {
			probFiles = append(probFiles, e.Name())
		}
	}
	sort.Strings(probFiles)

	var units []judgeUnit
	for _, fname := range probFiles {
		pad4 := strings.TrimSuffix(fname, ".json")
		idNum, _ := strconv.Atoi(pad4)
		if !want(strconv.Itoa(idNum)) && !want(pad4) {
			continue
		}
		casePath := filepath.Join(casesDir, fname)
		rawCases, err := os.ReadFile(casePath)
		if err != nil {
			continue
		}
		var cf judgeCasesFile
		if err := json.Unmarshal(rawCases, &cf); err != nil {
			return nil, fmt.Errorf("解析 cases/%s 失败: %w", fname, err)
		}
		rawData, err := os.ReadFile(filepath.Join(dataDir, fname))
		if err != nil {
			return nil, err
		}
		var df judgeIllFile
		if err := json.Unmarshal(rawData, &df); err != nil {
			return nil, err
		}
		ns, err := NormSig(cf.Sig)
		if err != nil {
			return nil, fmt.Errorf("题目 %d sig 错误: %w", idNum, err)
		}
		var codes []judgeCode
		for idx, ce := range df.Codes {
			if ce.Judge != nil && !*ce.Judge {
				continue
			}
			key := ce.Key
			if key == "" {
				if idx == 0 {
					key = "std"
				} else {
					key = fmt.Sprintf("c%d", idx)
				}
			}
			cmap := map[string]string{"python": ce.Code}
			for lang, pc := range ce.Langs {
				cmap[lang] = pc.Code
			}
			codes = append(codes, judgeCode{Key: key, T: ce.T, Code: cmap})
		}
		inputs := make([]any, len(cf.Cases))
		expect := make([]any, len(cf.Cases))
		for i, c := range cf.Cases {
			inputs[i] = c.In
			expect[i] = c.Out
		}
		units = append(units, judgeUnit{
			Name:   pad4,
			Label:  fmt.Sprintf("%d %s", df.ID, df.Name),
			Sig:    cf.Sig,
			Norm:   ns,
			Codes:  codes,
			Cases:  inputs,
			Expect: expect,
		})
	}

	topicDir := filepath.Join(dataDir, "topics")
	topicEntries, _ := os.ReadDir(topicDir)
	var topicFiles []string
	for _, e := range topicEntries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") && e.Name() != "index.json" {
			topicFiles = append(topicFiles, e.Name())
		}
	}
	sort.Strings(topicFiles)
	for _, tfName := range topicFiles {
		slug := strings.TrimSuffix(tfName, ".json")
		if !want(slug) {
			continue
		}
		rawTopic, err := os.ReadFile(filepath.Join(topicDir, tfName))
		if err != nil {
			return nil, err
		}
		var tf judgeTopicFile
		if err := json.Unmarshal(rawTopic, &tf); err != nil {
			return nil, fmt.Errorf("解析 topics/%s 失败: %w", tfName, err)
		}
		for _, sec := range tf.Sections {
			casePath := filepath.Join(casesDir, "topics", fmt.Sprintf("%s.%s.json", tf.Slug, sec.Key))
			rawCases, err := os.ReadFile(casePath)
			if err != nil {
				continue
			}
			var cf judgeCasesFile
			if err := json.Unmarshal(rawCases, &cf); err != nil {
				return nil, fmt.Errorf("解析 cases/topics/%s.%s.json 失败: %w", tf.Slug, sec.Key, err)
			}
			ns, err := NormSig(cf.Sig)
			if err != nil {
				return nil, fmt.Errorf("专题 %s/%s sig 错误: %w", tf.Slug, sec.Key, err)
			}
			var codes []judgeCode
			for idx, ce := range sec.Codes {
				if ce.Judge != nil && !*ce.Judge {
					continue
				}
				key := ce.Key
				if idx == 0 {
					key = sec.Key
				} else if key == "" {
					key = fmt.Sprintf("c%d", idx)
				}
				cmap := map[string]string{"python": ce.Code}
				for lang, pc := range ce.Langs {
					cmap[lang] = pc.Code
				}
				codes = append(codes, judgeCode{Key: key, T: ce.T, Code: cmap})
			}
			inputs := make([]any, len(cf.Cases))
			expect := make([]any, len(cf.Cases))
			for i, c := range cf.Cases {
				inputs[i] = c.In
				expect[i] = c.Out
			}
			units = append(units, judgeUnit{
				Name:   fmt.Sprintf("%s_%s", tf.Slug, sec.Key),
				Label:  fmt.Sprintf("专题 %s · %s", tf.Name, sec.T),
				Sig:    cf.Sig,
				Norm:   ns,
				Codes:  codes,
				Cases:  inputs,
				Expect: expect,
			})
		}
	}
	return units, nil
}

// JudgeWorkspace concurrently compiles and tests solutions across the selected languages.
func JudgeWorkspace(ctx context.Context, repoRoot string, opts JudgeOptions) error {
	workers := opts.Workers
	if workers <= 0 {
		workers = runtime.NumCPU()
	}
	langs := opts.Langs
	if len(langs) == 0 {
		langs = append([]string(nil), AllJudgeLangs...)
	}
	units, err := collectJudgeUnits(repoRoot, opts.Targets)
	if err != nil {
		return err
	}
	if len(units) == 0 {
		fmt.Println("没有带 sig 的题目")
		return nil
	}

	var totalFailed int
	for _, lang := range langs {
		if !slices.Contains(AllJudgeLangs, lang) {
			return fmt.Errorf("不认识的语言：%s", lang)
		}
		if !judgeToolAvailable(lang) {
			if opts.Require {
				fmt.Printf("✗ %s：本机没有它的工具链\n", lang)
				totalFailed++
			} else {
				fmt.Printf("- %s：本机没有它的工具链，跳过（CI 上会跑）\n", lang)
			}
			continue
		}

		var jobs []judgeJob
		for _, u := range units {
			for _, c := range u.Codes {
				src, ok := c.Code[lang]
				if !ok || strings.TrimSpace(src) == "" {
					continue
				}
				jobs = append(jobs, judgeJob{
					Name:   fmt.Sprintf("%s_%s", u.Name, c.Key),
					Label:  fmt.Sprintf("%s · %s", u.Label, c.T),
					Sig:    u.Norm,
					Cases:  u.Cases,
					Expect: u.Expect,
					Code:   src,
				})
			}
		}
		if len(jobs) == 0 {
			fmt.Printf("- %s：没有代码\n", lang)
			continue
		}

		workDir, err := os.MkdirTemp("", fmt.Sprintf("cd-judge-%s-", lang))
		if err != nil {
			return err
		}
		t0 := time.Now()
		var results []judgeResult
		var runErr error
		switch lang {
		case "python":
			results, runErr = runPythonJudgeJobs(ctx, repoRoot, workDir, jobs, workers)
		case "javascript":
			results, runErr = runJSJudgeJobs(ctx, repoRoot, workDir, jobs, workers, false, opts.Require)
		case "typescript":
			results, runErr = runJSJudgeJobs(ctx, repoRoot, workDir, jobs, workers, true, opts.Require)
		case "go":
			results, runErr = runGoJudgeJobs(ctx, repoRoot, workDir, jobs, workers)
		case "java":
			results, runErr = runJavaJudgeJobs(ctx, repoRoot, workDir, jobs, workers)
		case "cpp":
			results, runErr = runCppJudgeJobs(ctx, repoRoot, workDir, jobs, workers)
		}
		_ = os.RemoveAll(workDir)
		if runErr != nil {
			return runErr
		}

		langFail := 0
		for i, job := range jobs {
			r := results[i]
			if r.Error != "" {
				langFail++
				fmt.Printf("  ✗ %s\n      %s\n", job.Label, r.Error)
				continue
			}
			mismatchIdx := -1
			for k := range job.Expect {
				var got any
				if k < len(r.Outputs) {
					got = r.Outputs[k]
				}
				if !MatchesOutput(job.Expect[k], got, job.Sig.Cmp) {
					mismatchIdx = k
					break
				}
			}
			if mismatchIdx < 0 {
				continue
			}
			langFail++
			got := r.Outputs[mismatchIdx]
			gotStr := truncStr(CompactJSONString(got), 300)
			if gm, ok := got.(map[string]any); ok {
				if msg, has := gm["__error"]; has {
					gotStr = "出错：" + fmt.Sprint(msg)
				}
			}
			fmt.Printf("  ✗ %s\n      输入 %s\n      期望 %s\n      得到 %s\n",
				job.Label,
				truncStr(CompactJSONString(job.Cases[mismatchIdx]), 300),
				truncStr(CompactJSONString(job.Expect[mismatchIdx]), 300),
				gotStr,
			)
		}
		mark := "✓"
		if langFail > 0 {
			mark = "✗"
		}
		fmt.Printf("%s %s：%d / %d 段代码通过（%.1f 秒）\n", mark, lang, len(jobs)-langFail, len(jobs), time.Since(t0).Seconds())
		totalFailed += langFail
	}
	if totalFailed > 0 {
		return fmt.Errorf("%d 项判题未通过", totalFailed)
	}
	return nil
}

func truncStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func judgeToolAvailable(lang string) bool {
	switch lang {
	case "python":
		c := pythonCmdParts()
		return hasToolCmd(c[0], append(c[1:], "--version")...)
	case "javascript", "typescript":
		return hasToolCmd("node", "--version")
	case "go":
		return hasToolCmd("go", "version")
	case "java":
		return hasToolCmd("javac", "-version")
	case "cpp":
		return hasToolCmd("g++", "--version")
	default:
		return false
	}
}

func runPythonJudgeJobs(ctx context.Context, repoRoot, dir string, jobs []judgeJob, workers int) ([]judgeResult, error) {
	prelude, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "pytest_prelude.py"))
	if err != nil {
		return nil, err
	}
	runnerPy, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "judge", "prelude", "runner.py"))
	if err != nil {
		return nil, err
	}
	nodeDef := "\nclass Node:\n    def __init__(self, x: int, next: 'Node' = None, random: 'Node' = None):\n        self.val = int(x)\n        self.next = next\n        self.random = random\n"
	pyCmd := pythonCmdParts()
	results := make([]judgeResult, len(jobs))
	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)
	for i, job := range jobs {
		i, job := i, job
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			extra := ""
			if UsesType(job.Sig, "RandomList") {
				extra = nodeDef
			}
			pyPath := filepath.Join(dir, job.Name+".py")
			jsonPath := filepath.Join(dir, job.Name+".json")
			if err := os.WriteFile(pyPath, []byte(string(prelude)+extra+"\n"+job.Code+"\n"+string(runnerPy)), 0o644); err != nil {
				return err
			}
			payload, err := MarshalJSONNoEscape(map[string]any{"sig": FlatSigMap(job.Sig), "cases": job.Cases})
			if err != nil {
				return err
			}
			if err := os.WriteFile(jsonPath, payload, 0o644); err != nil {
				return err
			}
			stdout, stderr, _, timedOut := runCommandCapture(gCtx, dir, 30*time.Second, pyCmd[0], append(pyCmd[1:], pyPath, jsonPath)...)
			msg := lastNonEmptyLine(stderr)
			if timedOut {
				msg = "超时"
			}
			results[i] = judgeResult{Outputs: parseOutputLines(stdout, len(job.Cases), msg)}
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return results, nil
}

func jsRunnerSnippet(sig NormSignature, ts bool) string {
	A, N := "", ""
	if ts {
		A = ": any"
		N = ": number"
	}
	target := sig.Fn
	if sig.Kind == "design" {
		target = sig.Cls
	}
	return fmt.Sprintf(`
;(function () {
  const { sig, cases } = JSON.parse(__read(process.argv[2], "utf8"));
  const target%s = %s;
  for (const c of cases) {
    let out%s;
    __judge.reset();
    try {
      if (sig.kind === "design") {
        const [ops, argv] = c;
        const obj%s = new target(...argv[0].map((v%s, i%s) => __judge.in(sig.ctor[i], v)));
        out = [null];
        for (let k = 1; k < ops.length; k++) {
          const m = sig.methods[ops[k]];
          const r = obj[ops[k]](...argv[k].map((v%s, i%s) => __judge.in(m.params[i], v)));
          out.push(m.ret === "void" ? null : __judge.out(m.ret, r));
        }
      } else {
        const args = c.map((v%s, i%s) => __judge.in(sig.params[i], v));
        const r = target(...args);
        out = sig.ret === "void" ? __judge.out(sig.params[sig.out], args[sig.out]) : __judge.out(sig.ret, r);
      }
    } catch (e%s) { out = { __error: String((e && e.stack) || e).split("\n").slice(0, 2).join(" ") }; }
    console.log(JSON.stringify(out));
  }
})();
`, A, target, A, A, A, N, A, N, A, N, A)
}

var tscErrorRe = regexp.MustCompile(`([\w-]+)\.ts\((\d+),\d+\): error (TS\d+: .*)$`)

func findTSCCommand(repoRoot string) []string {
	if v := strings.TrimSpace(os.Getenv("TSC")); v != "" {
		if abs, err := filepath.Abs(v); err == nil {
			v = abs
		}
		return []string{"node", v}
	}
	if hasToolCmd("tsc", "-v") {
		return []string{"tsc"}
	}
	localTsc := filepath.Join(repoRoot, "site", "node_modules", "typescript", "bin", "tsc")
	if abs, err := filepath.Abs(localTsc); err == nil {
		localTsc = abs
	}
	if _, err := os.Stat(localTsc); err == nil {
		return []string{"node", localTsc}
	}
	return nil
}

func runJSJudgeJobs(ctx context.Context, repoRoot, dir string, jobs []judgeJob, workers int, ts bool, require bool) ([]judgeResult, error) {
	ext := "js"
	head := `const { readFileSync: __read } = require("fs");` + "\n"
	tail := ""
	nodeJS := "function _Node(val, next, random) {\n  this.val = val;\n  this.next = next;\n  this.random = random;\n}\n__judge.mkNode = (v) => new _Node(v, null, null);\n"
	nodeTS := "class _Node {\n  val: number;\n  next: _Node | null;\n  random: _Node | null;\n  constructor(val?: number, next?: _Node, random?: _Node) {\n    this.val = val === undefined ? 0 : val;\n    this.next = next === undefined ? null : next;\n    this.random = random === undefined ? null : random;\n  }\n}\n__judge.mkNode = (v: number) => new _Node(v);\n"
	nodeExtra := nodeJS
	if ts {
		ext = "ts"
		head = `import { readFileSync as __read } from "node:fs";` + "\n"
		tail = "export {};\n"
		nodeExtra = nodeTS
	}
	prelude, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "judge", "prelude", "prelude."+ext))
	if err != nil {
		return nil, err
	}

	results := make([]judgeResult, len(jobs))
	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)
	for i, job := range jobs {
		i, job := i, job
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			extra := ""
			if UsesType(job.Sig, "RandomList") {
				extra = nodeExtra
			}
			file := filepath.Join(dir, job.Name+"."+ext)
			jsonPath := filepath.Join(dir, job.Name+".json")
			src := head + string(prelude) + extra + "\n" + job.Code + "\n" + jsRunnerSnippet(job.Sig, ts) + tail
			if err := os.WriteFile(file, []byte(src), 0o644); err != nil {
				return err
			}
			payload, err := MarshalJSONNoEscape(map[string]any{"sig": FlatSigMap(job.Sig), "cases": job.Cases})
			if err != nil {
				return err
			}
			if err := os.WriteFile(jsonPath, payload, 0o644); err != nil {
				return err
			}
			stdout, stderr, _, timedOut := runCommandCapture(gCtx, dir, 30*time.Second, "node", file, jsonPath)
			msg := firstNLines(stderr, 6)
			if timedOut {
				msg = "超时"
			}
			results[i] = judgeResult{Outputs: parseOutputLines(stdout, len(job.Cases), msg)}
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}

	if ts {
		tsc := findTSCCommand(repoRoot)
		if len(tsc) == 0 {
			if require {
				return nil, fmt.Errorf("找不到 tsc：装上 typescript，或者把 TSC 设成 typescript/bin/tsc 的路径")
			}
			fmt.Println("  （找不到 tsc，跳过 TypeScript 的类型检查；可以设 TSC=<typescript/bin/tsc 的路径>）")
			return results, nil
		}
		checkDir := filepath.Join(dir, "check")
		if err := os.MkdirAll(checkDir, 0o755); err != nil {
			return nil, err
		}
		offsets := make(map[string]int, len(jobs))
		var files []string
		for _, job := range jobs {
			extra := ""
			if UsesType(job.Sig, "RandomList") {
				extra = nodeTS
			}
			prefix := string(prelude) + extra
			offsets[job.Name] = strings.Count(prefix, "\n") + 1
			p := filepath.Join(checkDir, job.Name+".ts")
			files = append(files, p)
			if err := os.WriteFile(p, []byte(prefix+"\n"+job.Code+"\nexport {};\n"), 0o644); err != nil {
				return nil, err
			}
		}
		args := append([]string{}, tsc[1:]...)
		args = append(args, "--noEmit", "--strict", "--target", "es2022", "--lib", "es2022", "--pretty", "false")
		args = append(args, files...)
		stdout, stderr, err, _ := runCommandCapture(ctx, dir, 300*time.Second, tsc[0], args...)
		combined := stdout + "\n" + stderr
		byJob := make(map[string][]string)
		for _, line := range strings.Split(strings.ReplaceAll(combined, "\r\n", "\n"), "\n") {
			if m := tscErrorRe.FindStringSubmatch(line); m != nil {
				lineNo, _ := strconv.Atoi(m[2])
				byJob[m[1]] = append(byJob[m[1]], fmt.Sprintf("第 %d 行 %s", lineNo-offsets[m[1]], m[3]))
			}
		}
		for i, job := range jobs {
			if msgs := byJob[job.Name]; len(msgs) > 0 {
				if len(msgs) > 5 {
					msgs = msgs[:5]
				}
				results[i].Error = "类型检查没过：" + strings.Join(msgs, "；")
			}
		}
		if err != nil && len(byJob) == 0 {
			return nil, fmt.Errorf("tsc 运行失败：%s", truncStr(combined, 500))
		}
	}
	return results, nil
}

// --- Go Judge ---

var goLineCommentRe = regexp.MustCompile(`(?m)//.*$`)
var goStringLitRe = regexp.MustCompile(`"(?:[^"\\]|\\.)*"`)
var goAutoPkgs = [][2]string{
	{"sort", "sort"}, {"strings", "strings"}, {"strconv", "strconv"}, {"math", "math"},
	{"heap", "container/heap"}, {"list", "container/list"}, {"bits", "math/bits"}, {"rand", "math/rand"},
	{"slices", "slices"}, {"maps", "maps"}, {"bytes", "bytes"}, {"unicode", "unicode"}, {"fmt", "fmt"},
}

func goInjectImports(code string) string {
	stripped := goStringLitRe.ReplaceAllString(goLineCommentRe.ReplaceAllString(code, ""), `""`)
	var used []string
	for _, p := range goAutoPkgs {
		re := regexp.MustCompile(`\b` + regexp.QuoteMeta(p[0]) + `\.[A-Za-z]`)
		if re.MatchString(stripped) {
			used = append(used, fmt.Sprintf("\t%q", p[1]))
		}
	}
	if len(used) == 0 {
		return code
	}
	return "import (\n" + strings.Join(used, "\n") + "\n)\n\n" + code
}

func goTypeStr(t NormType) string {
	if t.Arr != nil {
		return "[]" + goTypeStr(*t.Arr)
	}
	switch t.Base {
	case "int":
		return "int"
	case "long":
		return "int64"
	case "double":
		return "float64"
	case "bool":
		return "bool"
	case "string":
		return "string"
	case "char":
		return "byte"
	case "ListNode", "CycleList", "JoinList", "NodeIndex":
		return "*ListNode"
	case "TreeNode", "TreeRef", "TreeVal":
		return "*TreeNode"
	case "RandomList":
		return "*Node"
	default:
		return "any"
	}
}

func capIdent(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func charLitSingle(v any) string {
	s, _ := v.(string)
	switch s {
	case "'":
		return "'\\''"
	case `\`:
		return "'\\\\'"
	default:
		return "'" + s + "'"
	}
}

func int64Str(v any) string {
	switch n := v.(type) {
	case float64:
		return strconv.FormatInt(int64(n), 10)
	case int:
		return strconv.Itoa(n)
	case int64:
		return strconv.FormatInt(n, 10)
	default:
		return fmt.Sprint(v)
	}
}

func floatStr(v any) string {
	switch n := v.(type) {
	case float64:
		if n == float64(int64(n)) && math.Abs(n) < 1e15 {
			return fmt.Sprintf("%.1f", n)
		}
		return strconv.FormatFloat(n, 'g', -1, 64)
	default:
		return fmt.Sprint(v)
	}
}

func intArrayStr(v any) string {
	arr, _ := v.([]any)
	parts := make([]string, len(arr))
	for i, x := range arr {
		parts[i] = int64Str(x)
	}
	return strings.Join(parts, ", ")
}

func goLit(t NormType, v any) string {
	if t.Arr != nil {
		arr, _ := v.([]any)
		items := make([]string, len(arr))
		for i, x := range arr {
			items[i] = goLit(*t.Arr, x)
		}
		return fmt.Sprintf("%s{%s}", goTypeStr(t), strings.Join(items, ", "))
	}
	switch t.Base {
	case "long":
		return fmt.Sprintf("int64(%s)", int64Str(v))
	case "double":
		return fmt.Sprintf("float64(%s)", floatStr(v))
	case "string":
		return CompactJSONString(v)
	case "char":
		return fmt.Sprintf("byte(%s)", charLitSingle(v))
	case "ListNode":
		return fmt.Sprintf("judgeList([]int{%s})", intArrayStr(v))
	case "TreeNode":
		arr, _ := v.([]any)
		parts := make([]string, len(arr))
		for i, x := range arr {
			if x == nil {
				parts[i] = "nil"
			} else {
				parts[i] = int64Str(x)
			}
		}
		return fmt.Sprintf("judgeTree([]any{%s})", strings.Join(parts, ", "))
	case "CycleList", "JoinList":
		pair, _ := v.([]any)
		pos := "-1"
		if len(pair) > 1 && pair[1] != nil {
			pos = int64Str(pair[1])
		}
		fn := "judgeCycle"
		if t.Base == "JoinList" {
			fn = "judgeJoin"
		}
		return fmt.Sprintf("%s([]int{%s}, %s)", fn, intArrayStr(pair[0]), pos)
	case "TreeRef":
		return fmt.Sprintf("judgeFind(%s)", int64Str(v))
	case "RandomList":
		rows, _ := v.([]any)
		parts := make([]string, len(rows))
		for i, r := range rows {
			pair, _ := r.([]any)
			snd := "nil"
			if len(pair) > 1 && pair[1] != nil {
				snd = int64Str(pair[1])
			}
			parts[i] = fmt.Sprintf("{%s, %s}", int64Str(pair[0]), snd)
		}
		return fmt.Sprintf("judgeRandom([][]any{%s})", strings.Join(parts, ", "))
	default:
		return CompactJSONString(v)
	}
}

func goConv(t NormType, expr string) string {
	switch t.Base {
	case "ListNode":
		return fmt.Sprintf("judgeListVals(%s)", expr)
	case "TreeNode":
		return fmt.Sprintf("judgeTreeVals(%s)", expr)
	case "NodeIndex":
		return fmt.Sprintf("judgeIndex(%s)", expr)
	case "TreeVal":
		return fmt.Sprintf("judgeVal(%s)", expr)
	case "RandomList":
		return fmt.Sprintf("judgeRandomVals(%s)", expr)
	case "char":
		return fmt.Sprintf("string(rune(%s))", expr)
	}
	if t.Arr != nil && t.Arr.Base == "char" {
		return fmt.Sprintf("judgeBytes(%s)", expr)
	}
	if t.Arr != nil && t.Arr.Arr != nil && t.Arr.Arr.Base == "char" {
		return fmt.Sprintf("judgeBytes2(%s)", expr)
	}
	return expr
}

func goCaseBody(sig NormSignature, c any) []string {
	if sig.Kind == "design" {
		pair, _ := c.([]any)
		opsAny, _ := pair[0].([]any)
		argvAny, _ := pair[1].([]any)
		ctorArgs, _ := argvAny[0].([]any)
		ctorStrs := make([]string, len(ctorArgs))
		for i, v := range ctorArgs {
			ctorStrs[i] = goLit(sig.Ctor[i], v)
		}
		lines := []string{
			"out := []any{nil}",
			fmt.Sprintf("obj := Constructor(%s)", strings.Join(ctorStrs, ", ")),
			"_ = obj",
		}
		for k := 1; k < len(opsAny); k++ {
			opName, _ := opsAny[k].(string)
			m, _ := sig.Method(opName)
			argsSlice, _ := argvAny[k].([]any)
			argStrs := make([]string, len(argsSlice))
			for i, v := range argsSlice {
				argStrs[i] = goLit(m.Params[i], v)
			}
			call := fmt.Sprintf("obj.%s(%s)", capIdent(opName), strings.Join(argStrs, ", "))
			if m.Ret.Base == "void" {
				lines = append(lines, fmt.Sprintf("%s\n\t\tout = append(out, nil)", call))
			} else {
				lines = append(lines, fmt.Sprintf("out = append(out, %s)", goConv(m.Ret, call)))
			}
		}
		return append(lines, "return out")
	}
	cSlice, _ := c.([]any)
	var lines []string
	var argNames []string
	for i, v := range cSlice {
		lines = append(lines, fmt.Sprintf("a%d := %s", i, goLit(sig.Params[i], v)))
		argNames = append(argNames, fmt.Sprintf("a%d", i))
	}
	call := fmt.Sprintf("%s(%s)", sig.Fn, strings.Join(argNames, ", "))
	if sig.Ret.Base == "void" {
		outIdx := 0
		if sig.Out != nil {
			outIdx = *sig.Out
		}
		lines = append(lines, call, fmt.Sprintf("return %s", goConv(sig.Params[outIdx], fmt.Sprintf("a%d", outIdx))))
		return lines
	}
	return append(lines, fmt.Sprintf("return %s", goConv(sig.Ret, call)))
}

const goRandomNodeFile = `package main

type Node struct {
	Val    int
	Next   *Node
	Random *Node
}

var judgeMade []*Node

func judgeRandom(d [][]any) *Node {
	judgeMade = nil
	for _, x := range d {
		judgeMade = append(judgeMade, &Node{Val: x[0].(int)})
	}
	for i, x := range d {
		if i+1 < len(d) {
			judgeMade[i].Next = judgeMade[i+1]
		}
		if x[1] != nil {
			judgeMade[i].Random = judgeMade[x[1].(int)]
		}
	}
	if len(judgeMade) == 0 {
		return nil
	}
	return judgeMade[0]
}

func judgeRandomVals(head *Node) any {
	idx := map[*Node]int{}
	for p := head; p != nil && len(idx) < 100000; p = p.Next {
		idx[p] = len(idx)
	}
	old := map[*Node]bool{}
	for _, n := range judgeMade {
		old[n] = true
	}
	out := [][]any{}
	for p := head; p != nil && len(out) < 100000; p = p.Next {
		if old[p] {
			return "没有复制：返回了原链表的节点"
		}
		var r any
		if p.Random != nil {
			if k, ok := idx[p.Random]; ok {
				r = k
			} else {
				r = "?"
			}
		}
		out = append(out, []any{p.Val, r})
	}
	return out
}
`

func runGoJudgeJobs(ctx context.Context, repoRoot, dir string, jobs []judgeJob, workers int) ([]judgeResult, error) {
	prelude, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "judge", "prelude", "prelude.go"))
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(dir, "bin"), 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte("module judge\n\ngo 1.21\n"), 0o644); err != nil {
		return nil, err
	}
	exeSuffix := ""
	if runtime.GOOS == "windows" {
		exeSuffix = ".exe"
	}

	results := make([]judgeResult, len(jobs))
	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)
	for i, job := range jobs {
		i, job := i, job
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			pkgName := "j" + job.Name
			pkgDir := filepath.Join(dir, pkgName)
			_ = os.RemoveAll(pkgDir)
			if err := os.MkdirAll(pkgDir, 0o755); err != nil {
				return err
			}
			if err := os.WriteFile(filepath.Join(pkgDir, "prelude.go"), prelude, 0o644); err != nil {
				return err
			}
			if err := os.WriteFile(filepath.Join(pkgDir, "sol.go"), []byte("package main\n\n"+goInjectImports(job.Code)+"\n"), 0o644); err != nil {
				return err
			}
			var caseBlocks []string
			for _, c := range job.Cases {
				caseBlocks = append(caseBlocks, fmt.Sprintf("\tjudgeRun(func() any {\n\t\tjudgeReset()\n\t\t%s\n\t})", strings.Join(goCaseBody(job.Sig, c), "\n\t\t")))
			}
			mainSrc := fmt.Sprintf(`package main

import (
	"encoding/json"
	"fmt"
)

func judgeRun(f func() any) {
	defer func() {
		if r := recover(); r != nil {
			b, _ := json.Marshal(map[string]string{"__error": fmt.Sprint(r)})
			fmt.Println(string(b))
		}
	}()
	b, err := json.Marshal(f())
	if err != nil {
		b, _ = json.Marshal(map[string]string{"__error": err.Error()})
	}
	fmt.Println(string(b))
}

func main() {
%s
}
`, strings.Join(caseBlocks, "\n"))
			if err := os.WriteFile(filepath.Join(pkgDir, "main.go"), []byte(mainSrc), 0o644); err != nil {
				return err
			}
			if UsesType(job.Sig, "RandomList") {
				if err := os.WriteFile(filepath.Join(pkgDir, "random.go"), []byte(goRandomNodeFile), 0o644); err != nil {
					return err
				}
			}
			binPath := filepath.Join(dir, "bin", job.Name+exeSuffix)
			_, bErr, buildErr, _ := runCommandCapture(gCtx, dir, 180*time.Second, "go", "build", "-o", binPath, "./"+pkgName)
			if buildErr != nil {
				var errLines []string
				for _, l := range strings.Split(bErr, "\n") {
					if l != "" && !strings.HasPrefix(l, "#") {
						errLines = append(errLines, l)
						if len(errLines) >= 6 {
							break
						}
					}
				}
				results[i] = judgeResult{Error: "编译没过：" + strings.Join(errLines, " | ")}
				return nil
			}
			stdout, stderr, _, timedOut := runCommandCapture(gCtx, dir, 30*time.Second, binPath)
			msg := firstNLines(stderr, 3)
			if timedOut {
				msg = "超时"
			}
			results[i] = judgeResult{Outputs: parseOutputLines(stdout, len(job.Cases), msg)}
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return results, nil
}

// --- Java Judge ---

var javaNonWordRe = regexp.MustCompile(`[^\w]`)
var javaImportRe = regexp.MustCompile(`^\s*import\s+[\w.*]+\s*;\s*$`)
var javaPublicClassRe = regexp.MustCompile(`(?m)^public class `)
var javaCompileErrRe = regexp.MustCompile(`[\\/](j\w+)[\\/]Main\.java:\d+: (?:error|错误): (.*)$`)

func javaPkgName(jobName string) string {
	return "j" + javaNonWordRe.ReplaceAllString(jobName, "_")
}

func javaBoxType(t NormType) string {
	switch t.Base {
	case "int":
		return "Integer"
	case "long":
		return "Long"
	case "double":
		return "Double"
	case "bool":
		return "Boolean"
	case "string":
		return "String"
	case "char":
		return "Character"
	case "":
		return javaTypeStr(t)
	default:
		return t.Base
	}
}

func javaTypeStr(t NormType) string {
	if t.Arr != nil {
		if t.List {
			return fmt.Sprintf("List<%s>", javaBoxType(*t.Arr))
		}
		return javaTypeStr(*t.Arr) + "[]"
	}
	switch t.Base {
	case "int":
		return "int"
	case "long":
		return "long"
	case "double":
		return "double"
	case "bool":
		return "boolean"
	case "string":
		return "String"
	case "char":
		return "char"
	case "ListNode", "CycleList", "JoinList", "NodeIndex":
		return "ListNode"
	case "TreeNode", "TreeRef", "TreeVal":
		return "TreeNode"
	case "RandomList":
		return "Node"
	default:
		return t.Base
	}
}

func javaLit(t NormType, v any) string {
	if t.Arr != nil {
		arr, _ := v.([]any)
		items := make([]string, len(arr))
		for i, x := range arr {
			items[i] = javaLit(*t.Arr, x)
		}
		if t.List {
			if len(items) == 0 {
				return fmt.Sprintf("new ArrayList<%s>()", javaBoxType(*t.Arr))
			}
			return fmt.Sprintf("new ArrayList<%s>(Arrays.asList(%s))", javaBoxType(*t.Arr), strings.Join(items, ", "))
		}
		return fmt.Sprintf("new %s{%s}", javaTypeStr(t), strings.Join(items, ", "))
	}
	switch t.Base {
	case "long":
		return int64Str(v) + "L"
	case "double":
		return floatStr(v)
	case "string":
		return CompactJSONString(v)
	case "char":
		return charLitSingle(v)
	case "ListNode":
		return fmt.Sprintf("H.list(new int[]{%s})", intArrayStr(v))
	case "TreeNode":
		arr, _ := v.([]any)
		parts := make([]string, len(arr))
		for i, x := range arr {
			if x == nil {
				parts[i] = "null"
			} else {
				parts[i] = int64Str(x)
			}
		}
		return fmt.Sprintf("H.tree(new Integer[]{%s})", strings.Join(parts, ", "))
	case "CycleList", "JoinList":
		pair, _ := v.([]any)
		pos := "-1"
		if len(pair) > 1 && pair[1] != nil {
			pos = int64Str(pair[1])
		}
		fn := "H.cycle"
		if t.Base == "JoinList" {
			fn = "H.join"
		}
		return fmt.Sprintf("%s(new int[]{%s}, %s)", fn, intArrayStr(pair[0]), pos)
	case "TreeRef":
		return fmt.Sprintf("H.find(%s)", int64Str(v))
	case "RandomList":
		rows, _ := v.([]any)
		parts := make([]string, len(rows))
		for i, r := range rows {
			pair, _ := r.([]any)
			snd := "null"
			if len(pair) > 1 && pair[1] != nil {
				snd = int64Str(pair[1])
			}
			parts[i] = fmt.Sprintf("{%s, %s}", int64Str(pair[0]), snd)
		}
		return fmt.Sprintf("HR.build(new Integer[][]{%s})", strings.Join(parts, ", "))
	default:
		return CompactJSONString(v)
	}
}

func javaOutExpr(t NormType, expr string) string {
	switch t.Base {
	case "NodeIndex":
		return fmt.Sprintf("H.index(%s)", expr)
	case "TreeVal":
		return fmt.Sprintf("H.val(%s)", expr)
	case "RandomList":
		return fmt.Sprintf("HR.out(%s)", expr)
	default:
		return expr
	}
}

func javaCaseBody(sig NormSignature, c any) []string {
	if sig.Kind == "design" {
		pair, _ := c.([]any)
		opsAny, _ := pair[0].([]any)
		argvAny, _ := pair[1].([]any)
		ctorArgs, _ := argvAny[0].([]any)
		ctorStrs := make([]string, len(ctorArgs))
		for i, v := range ctorArgs {
			ctorStrs[i] = javaLit(sig.Ctor[i], v)
		}
		lines := []string{
			"List<Object> out = new ArrayList<>();",
			"out.add(null);",
			fmt.Sprintf("%s obj = new %s(%s);", sig.Cls, sig.Cls, strings.Join(ctorStrs, ", ")),
		}
		for k := 1; k < len(opsAny); k++ {
			opName, _ := opsAny[k].(string)
			m, _ := sig.Method(opName)
			argsSlice, _ := argvAny[k].([]any)
			argStrs := make([]string, len(argsSlice))
			for i, v := range argsSlice {
				argStrs[i] = javaLit(m.Params[i], v)
			}
			call := fmt.Sprintf("obj.%s(%s)", opName, strings.Join(argStrs, ", "))
			if m.Ret.Base == "void" {
				lines = append(lines, fmt.Sprintf("%s; out.add(null);", call))
			} else {
				lines = append(lines, fmt.Sprintf("out.add(%s);", javaOutExpr(m.Ret, call)))
			}
		}
		return append(lines, "System.out.println(H.json(out));")
	}
	cSlice, _ := c.([]any)
	var lines []string
	var argNames []string
	for i, v := range cSlice {
		lines = append(lines, fmt.Sprintf("%s a%d = %s;", javaTypeStr(sig.Params[i]), i, javaLit(sig.Params[i], v)))
		argNames = append(argNames, fmt.Sprintf("a%d", i))
	}
	call := fmt.Sprintf("new Solution().%s(%s)", sig.Fn, strings.Join(argNames, ", "))
	if sig.Ret.Base == "void" {
		outIdx := 0
		if sig.Out != nil {
			outIdx = *sig.Out
		}
		lines = append(lines, call+";", fmt.Sprintf("System.out.println(H.json(%s));", javaOutExpr(sig.Params[outIdx], fmt.Sprintf("a%d", outIdx))))
		return lines
	}
	return append(lines, fmt.Sprintf("System.out.println(H.json(%s));", javaOutExpr(sig.Ret, call)))
}

const javaRandomNode = `
class Node {
    int val;
    Node next;
    Node random;

    public Node(int val) {
        this.val = val;
        this.next = null;
        this.random = null;
    }
}

class HR {
    static ArrayList<Node> made = new ArrayList<>();

    static Node build(Integer[][] data) {
        made.clear();
        for (Integer[] d : data) made.add(new Node(d[0]));
        for (int i = 0; i < data.length; i++) {
            made.get(i).next = i + 1 < data.length ? made.get(i + 1) : null;
            made.get(i).random = data[i][1] == null ? null : made.get(data[i][1]);
        }
        return made.isEmpty() ? null : made.get(0);
    }

    static Object out(Node head) {
        IdentityHashMap<Node, Integer> idx = new IdentityHashMap<>();
        for (Node p = head; p != null && idx.size() < 100000; p = p.next) idx.put(p, idx.size());
        Set<Node> old = Collections.newSetFromMap(new IdentityHashMap<>());
        old.addAll(made);
        List<Object> out = new ArrayList<>();
        for (Node p = head; p != null && out.size() < 100000; p = p.next) {
            if (old.contains(p)) return "没有复制：返回了原链表的节点";
            Object r = p.random == null ? null : idx.containsKey(p.random) ? (Object) idx.get(p.random) : "?";
            out.add(Arrays.asList((Object) p.val, r));
        }
        return out;
    }
}
`

func runJavaJudgeJobs(ctx context.Context, repoRoot, dir string, jobs []judgeJob, workers int) ([]judgeResult, error) {
	prelude, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "judge", "prelude", "Prelude.java"))
	if err != nil {
		return nil, err
	}
	srcRoot := filepath.Join(dir, "src")
	outRoot := filepath.Join(dir, "out")
	if err := os.MkdirAll(outRoot, 0o755); err != nil {
		return nil, err
	}
	for _, job := range jobs {
		pkg := javaPkgName(job.Name)
		pkgDir := filepath.Join(srcRoot, pkg)
		if err := os.MkdirAll(pkgDir, 0o755); err != nil {
			return nil, err
		}
		var imports, body []string
		for _, line := range strings.Split(javaPublicClassRe.ReplaceAllString(job.Code, "class "), "\n") {
			if javaImportRe.MatchString(line) {
				imports = append(imports, line)
			} else {
				body = append(body, line)
			}
		}
		extra := ""
		if UsesType(job.Sig, "RandomList") {
			extra = javaRandomNode
		}
		var caseMethods, caseCalls []string
		for k, c := range job.Cases {
			caseMethods = append(caseMethods, fmt.Sprintf("    static void c%d() {\n        H.reset();\n        %s\n    }", k, strings.Join(javaCaseBody(job.Sig, c), "\n        ")))
			caseCalls = append(caseCalls, fmt.Sprintf(`        try { c%d(); } catch (Throwable e) { System.out.println("{\"__error\":" + H.json(String.valueOf(e)) + "}"); }`, k))
		}
		src := fmt.Sprintf("package %s;\n\nimport java.util.*;\n%s\n\n%s\n%s\n%s\n\npublic class Main {\n%s\n\n    public static void main(String[] args) {\n%s\n    }\n}\n",
			pkg, strings.Join(imports, "\n"), string(prelude), extra, strings.Join(body, "\n"), strings.Join(caseMethods, "\n"), strings.Join(caseCalls, "\n"))
		if err := os.WriteFile(filepath.Join(pkgDir, "Main.java"), []byte(src), 0o644); err != nil {
			return nil, err
		}
	}

	failed := make(map[string]string)
	live := append([]judgeJob(nil), jobs...)
	filesTxt := filepath.Join(dir, "files.txt")
	for round := 0; round < 6 && len(live) > 0; round++ {
		var fileLines []string
		for _, j := range live {
			p := filepath.ToSlash(filepath.Join(srcRoot, javaPkgName(j.Name), "Main.java"))
			fileLines = append(fileLines, CompactJSONString(p))
		}
		if err := os.WriteFile(filesTxt, []byte(strings.Join(fileLines, "\n")), 0o644); err != nil {
			return nil, err
		}
		_, stderr, compErr, _ := runCommandCapture(ctx, dir, 600*time.Second, "javac", "-encoding", "UTF-8", "-nowarn", "-Xlint:none", "-d", outRoot, "@"+filesTxt)
		if compErr == nil {
			break
		}
		bad := make(map[string][]string)
		for _, line := range strings.Split(strings.ReplaceAll(stderr, "\r\n", "\n"), "\n") {
			if m := javaCompileErrRe.FindStringSubmatch(line); m != nil {
				bad[m[1]] = append(bad[m[1]], m[2])
			}
		}
		if len(bad) == 0 {
			return nil, fmt.Errorf("javac 运行失败：%s", truncStr(stderr, 800))
		}
		for p, msgs := range bad {
			if len(msgs) > 4 {
				msgs = msgs[:4]
			}
			failed[p] = "编译没过：" + strings.Join(msgs, " | ")
		}
		var next []judgeJob
		for _, j := range live {
			if _, ok := failed[javaPkgName(j.Name)]; !ok {
				next = append(next, j)
			}
		}
		live = next
	}

	results := make([]judgeResult, len(jobs))
	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)
	for i, job := range jobs {
		i, job := i, job
		pkg := javaPkgName(job.Name)
		if msg, ok := failed[pkg]; ok {
			results[i] = judgeResult{Error: msg}
			continue
		}
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			stdout, stderr, _, timedOut := runCommandCapture(gCtx, dir, 30*time.Second, "java", "-Xss64m", "-cp", outRoot, pkg+".Main")
			msg := firstNLines(stderr, 3)
			if timedOut {
				msg = "超时"
			}
			results[i] = judgeResult{Outputs: parseOutputLines(stdout, len(job.Cases), msg)}
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return results, nil
}

// --- C++ Judge ---

var cppPrefixStripRe = regexp.MustCompile(`^.*?\.cpp:`)

func cppTypeStr(t NormType) string {
	if t.Arr != nil {
		return "vector<" + cppTypeStr(*t.Arr) + ">"
	}
	switch t.Base {
	case "int":
		return "int"
	case "long":
		return "long long"
	case "double":
		return "double"
	case "bool":
		return "bool"
	case "string":
		return "string"
	case "char":
		return "char"
	case "ListNode", "CycleList", "JoinList", "NodeIndex":
		return "ListNode*"
	case "TreeNode", "TreeRef", "TreeVal":
		return "TreeNode*"
	case "RandomList":
		return "Node*"
	default:
		return t.Base
	}
}

func cppStringExpr(v any) string {
	s, _ := v.(string)
	var b strings.Builder
	b.WriteString(`string("`)
	for _, r := range s {
		switch r {
		case '\\':
			b.WriteString(`\\`)
		case '"':
			b.WriteString(`\"`)
		case '\n':
			b.WriteString(`\n`)
		case '\t':
			b.WriteString(`\t`)
		default:
			b.WriteRune(r)
		}
	}
	b.WriteString(`")`)
	return b.String()
}

func cppLit(t NormType, v any) string {
	if t.Arr != nil {
		arr, _ := v.([]any)
		items := make([]string, len(arr))
		for i, x := range arr {
			items[i] = cppLit(*t.Arr, x)
		}
		return fmt.Sprintf("%s{%s}", cppTypeStr(t), strings.Join(items, ", "))
	}
	switch t.Base {
	case "long":
		return int64Str(v) + "LL"
	case "double":
		return floatStr(v)
	case "bool":
		if b, _ := v.(bool); b {
			return "true"
		}
		return "false"
	case "string":
		return cppStringExpr(v)
	case "char":
		return charLitSingle(v)
	case "ListNode":
		return fmt.Sprintf("jList(vector<int>{%s})", intArrayStr(v))
	case "TreeNode":
		arr, _ := v.([]any)
		parts := make([]string, len(arr))
		for i, x := range arr {
			if x == nil {
				parts[i] = "JNUL"
			} else {
				parts[i] = int64Str(x)
			}
		}
		return fmt.Sprintf("jTree(vector<int>{%s})", strings.Join(parts, ", "))
	case "CycleList", "JoinList":
		pair, _ := v.([]any)
		pos := "-1"
		if len(pair) > 1 && pair[1] != nil {
			pos = int64Str(pair[1])
		}
		fn := "jCycle"
		if t.Base == "JoinList" {
			fn = "jJoinList"
		}
		return fmt.Sprintf("%s(vector<int>{%s}, %s)", fn, intArrayStr(pair[0]), pos)
	case "TreeRef":
		return fmt.Sprintf("jFind(%s)", int64Str(v))
	case "RandomList":
		rows, _ := v.([]any)
		parts := make([]string, len(rows))
		for i, r := range rows {
			pair, _ := r.([]any)
			snd := "JNUL"
			if len(pair) > 1 && pair[1] != nil {
				snd = int64Str(pair[1])
			}
			parts[i] = fmt.Sprintf("{%s, %s}", int64Str(pair[0]), snd)
		}
		return fmt.Sprintf("jRandom(vector<pair<int, int>>{%s})", strings.Join(parts, ", "))
	default:
		return CompactJSONString(v)
	}
}

func cppOutExpr(t NormType, expr string) string {
	switch t.Base {
	case "NodeIndex":
		return fmt.Sprintf("jIndex(%s)", expr)
	case "TreeVal":
		return fmt.Sprintf("jVal(%s)", expr)
	case "RandomList":
		return fmt.Sprintf("jsRandom(%s)", expr)
	default:
		return fmt.Sprintf("js(%s)", expr)
	}
}

func cppCaseBody(sig NormSignature, c any) []string {
	if sig.Kind == "design" {
		pair, _ := c.([]any)
		opsAny, _ := pair[0].([]any)
		argvAny, _ := pair[1].([]any)
		ctorArgs, _ := argvAny[0].([]any)
		ctorStrs := make([]string, len(ctorArgs))
		for i, v := range ctorArgs {
			ctorStrs[i] = cppLit(sig.Ctor[i], v)
		}
		lines := []string{
			`vector<string> out{"null"};`,
			fmt.Sprintf("%s* obj = new %s(%s);", sig.Cls, sig.Cls, strings.Join(ctorStrs, ", ")),
		}
		for k := 1; k < len(opsAny); k++ {
			opName, _ := opsAny[k].(string)
			m, _ := sig.Method(opName)
			argsSlice, _ := argvAny[k].([]any)
			argStrs := make([]string, len(argsSlice))
			for i, v := range argsSlice {
				argStrs[i] = cppLit(m.Params[i], v)
			}
			call := fmt.Sprintf("obj->%s(%s)", opName, strings.Join(argStrs, ", "))
			if m.Ret.Base == "void" {
				lines = append(lines, fmt.Sprintf(`%s; out.push_back("null");`, call))
			} else {
				lines = append(lines, fmt.Sprintf("out.push_back(%s);", cppOutExpr(m.Ret, call)))
			}
		}
		return append(lines, "cout << jJoin(out) << endl;")
	}
	cSlice, _ := c.([]any)
	var lines []string
	var argNames []string
	for i, v := range cSlice {
		lines = append(lines, fmt.Sprintf("%s a%d = %s;", cppTypeStr(sig.Params[i]), i, cppLit(sig.Params[i], v)))
		argNames = append(argNames, fmt.Sprintf("a%d", i))
	}
	lines = append(lines, "Solution sol;")
	call := fmt.Sprintf("sol.%s(%s)", sig.Fn, strings.Join(argNames, ", "))
	if sig.Ret.Base == "void" {
		outIdx := 0
		if sig.Out != nil {
			outIdx = *sig.Out
		}
		lines = append(lines, call+";", fmt.Sprintf("cout << %s << endl;", cppOutExpr(sig.Params[outIdx], fmt.Sprintf("a%d", outIdx))))
		return lines
	}
	return append(lines, fmt.Sprintf("cout << %s << endl;", cppOutExpr(sig.Ret, call)))
}

const cppRandomNode = `
class Node {
public:
    int val;
    Node* next;
    Node* random;

    Node(int _val) {
        val = _val;
        next = NULL;
        random = NULL;
    }
};

static vector<Node*> jMade;
static Node* jRandom(const vector<pair<int, int>>& d) {
    jMade.clear();
    for (auto& p : d) jMade.push_back(new Node(p.first));
    for (size_t i = 0; i < d.size(); i++) {
        jMade[i]->next = i + 1 < d.size() ? jMade[i + 1] : nullptr;
        jMade[i]->random = d[i].second == JNUL ? nullptr : jMade[d[i].second];
    }
    return jMade.empty() ? nullptr : jMade[0];
}
static string jsRandom(Node* head) {
    unordered_map<Node*, int> idx;
    for (Node* p = head; p && idx.size() < 100000; p = p->next) { int k = idx.size(); idx.emplace(p, k); }
    unordered_set<Node*> old(jMade.begin(), jMade.end());
    vector<string> out;
    for (Node* p = head; p && out.size() < 100000; p = p->next) {
        if (old.count(p)) return js(string("没有复制：返回了原链表的节点"));
        string r = !p->random ? string("null") : idx.count(p->random) ? to_string(idx[p->random]) : js(string("?"));
        out.push_back("[" + to_string(p->val) + "," + r + "]");
    }
    return jJoin(out);
}
`

func runCppJudgeJobs(ctx context.Context, repoRoot, dir string, jobs []judgeJob, workers int) ([]judgeResult, error) {
	prelude, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "judge", "prelude", "prelude.h"))
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(dir, "bin"), 0o755); err != nil {
		return nil, err
	}
	hdrPath := filepath.Join(dir, "prelude.h")
	if err := os.WriteFile(hdrPath, prelude, 0o644); err != nil {
		return nil, err
	}
	gchPath := filepath.Join(dir, "prelude.h.gch")
	_, pchErr, compErr, _ := runCommandCapture(ctx, dir, 300*time.Second, "g++", "-std=c++20", "-O1", "-w", "-x", "c++-header", hdrPath, "-o", gchPath)
	if compErr != nil {
		return nil, fmt.Errorf("前置头文件编译失败：%s", truncStr(pchErr, 800))
	}
	exeSuffix := ""
	if runtime.GOOS == "windows" {
		exeSuffix = ".exe"
	}

	results := make([]judgeResult, len(jobs))
	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)
	for i, job := range jobs {
		i, job := i, job
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			extra := ""
			if UsesType(job.Sig, "RandomList") {
				extra = cppRandomNode
			}
			var caseFns, mainCalls []string
			for k, c := range job.Cases {
				caseFns = append(caseFns, fmt.Sprintf("static void jCase%d() {\n    jReset();\n    %s\n}", k, strings.Join(cppCaseBody(job.Sig, c), "\n    ")))
				mainCalls = append(mainCalls, fmt.Sprintf(`    try { jCase%d(); } catch (const exception& e) { cout << "{\"__error\":" << js(string(e.what())) << "}" << endl; } catch (...) { cout << "{\"__error\":\"exception\"}" << endl; }`, k))
			}
			src := fmt.Sprintf("#include \"prelude.h\"\n%s\n%s\n\n%s\n\nint main() {\n%s\n    return 0;\n}\n",
				extra, job.Code, strings.Join(caseFns, "\n"), strings.Join(mainCalls, "\n"))
			cppPath := filepath.Join(dir, job.Name+".cpp")
			binPath := filepath.Join(dir, "bin", job.Name+exeSuffix)
			if err := os.WriteFile(cppPath, []byte(src), 0o644); err != nil {
				return err
			}
			_, bErr, bRunErr, _ := runCommandCapture(gCtx, dir, 300*time.Second, "g++", "-std=c++20", "-O1", "-w", "-I", dir, "-o", binPath, cppPath)
			if bRunErr != nil {
				var errs []string
				for _, l := range strings.Split(bErr, "\n") {
					if strings.Contains(l, "error") {
						errs = append(errs, cppPrefixStripRe.ReplaceAllString(l, ""))
						if len(errs) >= 4 {
							break
						}
					}
				}
				results[i] = judgeResult{Error: "编译没过：" + strings.Join(errs, " | ")}
				return nil
			}
			stdout, _, runErr, timedOut := runCommandCapture(gCtx, dir, 30*time.Second, binPath)
			extraMsg := ""
			if timedOut {
				extraMsg = "超时"
			} else if runErr != nil {
				extraMsg = fmt.Sprintf("程序崩溃了（%v）", runErr)
			}
			results[i] = judgeResult{Outputs: parseOutputLines(stdout, len(job.Cases), extraMsg)}
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return results, nil
}
