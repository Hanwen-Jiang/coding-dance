package builder

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/Hanwen-Jiang/coding-dance/internal/conc"
)

var unorderedPracticeIDs = map[int]bool{
	15: true, 17: true, 22: true, 39: true, 46: true,
	49: true, 51: true, 78: true, 131: true, 347: true,
}

type PracticeExampleSource struct {
	Path   string `json:"path"`
	Index  int    `json:"index"`
	Input  string `json:"input"`
	Output string `json:"output"`
}

type PracticeCase struct {
	Input    []any                  `json:"input"`
	Label    string                 `json:"label"`
	Quick    bool                   `json:"quick,omitempty"`
	Expected any                    `json:"expected"`
	Stdin    string                 `json:"stdin"`
	Stdout   string                 `json:"stdout"`
	Source   *PracticeExampleSource `json:"source,omitempty"`
}

type PracticeACMExample struct {
	Input       string `json:"input"`
	Output      string `json:"output"`
	Explanation string `json:"explanation"`
}

type PracticeACM struct {
	Description string               `json:"description"`
	Input       string               `json:"input"`
	Output      string               `json:"output"`
	Notes       []string             `json:"notes"`
	Examples    []PracticeACMExample `json:"examples"`
}

// PracticeProblem matches the exact schema and key order of tools/practice/data/<pad4>.json.
type PracticeProblem struct {
	ID                            int                          `json:"id"`
	Name                          string                       `json:"name"`
	Signature                     RawSignature                 `json:"signature"`
	ParameterNames                []string                     `json:"parameterNames"`
	Starters                      map[string]map[string]string `json:"starters"`
	LeetcodeUnavailable           map[string]string            `json:"leetcodeUnavailable,omitempty"`
	LegacyAcmStarterHashes        map[string]string            `json:"legacyAcmStarterHashes"`
	Cases                         []PracticeCase               `json:"cases"`
	Examples                      []PracticeCase               `json:"examples"`
	Acm                           PracticeACM                  `json:"acm"`
	PreviousAcmStarterHashes      map[string][]string          `json:"previousAcmStarterHashes"`
	PreviousLeetcodeStarterHashes map[string][]string          `json:"previousLeetcodeStarterHashes"`
}

var reFourDigitSpec = regexp.MustCompile(`^(\d{4})\.js$`)

// BuildPracticeData generates all 100 tools/practice/data/<pad4>.json files in pure Go using concurrent workers.
func BuildPracticeData(ctx context.Context, repoRoot string, workers int) (int, int, error) {
	if workers <= 0 {
		workers = runtime.GOMAXPROCS(0)
	}
	meta, err := loadPracticeMeta(repoRoot)
	if err != nil {
		return 0, 0, err
	}

	startersBytes, err := os.ReadFile(filepath.Join(repoRoot, "tools", "practice", "leetcode-starters.json"))
	if err != nil {
		return 0, 0, fmt.Errorf("read leetcode-starters.json: %w", err)
	}
	var leetcodeStarters map[string]map[string]string
	if err := json.Unmarshal(startersBytes, &leetcodeStarters); err != nil {
		return 0, 0, fmt.Errorf("parse leetcode-starters.json: %w", err)
	}

	specEntries, err := os.ReadDir(filepath.Join(repoRoot, "tools", "illustrations", "specs"))
	if err != nil {
		return 0, 0, fmt.Errorf("read specs dir: %w", err)
	}
	var pads []string
	for _, e := range specEntries {
		if m := reFourDigitSpec.FindStringSubmatch(e.Name()); m != nil {
			pads = append(pads, m[1])
		}
	}
	sort.Strings(pads)

	outDir := filepath.Join(repoRoot, "tools", "practice", "data")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return 0, 0, err
	}

	g, gctx := conc.WithContext(ctx)
	g.SetLimit(workers)

	var totalCases, totalExamples atomic.Int64
	for _, pad4 := range pads {
		pad4 := pad4
		g.Go(func() error {
			cCount, exCount, err := buildOnePracticeProblem(gctx, repoRoot, pad4, meta, leetcodeStarters, outDir)
			if err != nil {
				return err
			}
			totalCases.Add(int64(cCount))
			totalExamples.Add(int64(exCount))
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return 0, 0, err
	}
	return int(totalCases.Load()), int(totalExamples.Load()), nil
}

func buildOnePracticeProblem(
	ctx context.Context,
	repoRoot, pad4 string,
	meta practiceMetaContract,
	leetcodeStarters map[string]map[string]string,
	outDir string,
) (int, int, error) {
	illBytes, err := os.ReadFile(filepath.Join(repoRoot, "tools", "illustrations", "data", pad4+".json"))
	if err != nil {
		return 0, 0, fmt.Errorf("%s: missing illustrations data (run illustration build first): %w", pad4, err)
	}
	var ill judgeIllFile
	if err := json.Unmarshal(illBytes, &ill); err != nil {
		return 0, 0, fmt.Errorf("%s: parse illustrations data: %w", pad4, err)
	}
	if len(ill.Codes) == 0 {
		return 0, 0, fmt.Errorf("%s: no reference Python code in illustrations data", pad4)
	}
	pyCode := ill.Codes[0].Code

	casesPath := filepath.Join(repoRoot, "tools", "illustrations", "cases", pad4+".json")
	casesBytes, err := os.ReadFile(casesPath)
	if err != nil {
		return 0, 0, fmt.Errorf("%s: missing illustrations cases (run illustration build first): %w", pad4, err)
	}
	var casesFile judgeCasesFile
	if err := json.Unmarshal(casesBytes, &casesFile); err != nil {
		return 0, 0, fmt.Errorf("%s: parse cases: %w", pad4, err)
	}

	idStr := strconv.Itoa(ill.ID)
	desc := meta.Descriptions[idStr]
	bounds, hasBounds := meta.Boundaries[idStr]
	if desc == "" || !hasBounds {
		return 0, 0, fmt.Errorf("%d: missing authored statement or boundary case in contracts/practice-meta.json", ill.ID)
	}

	sig := casesFile.Sig.Clone()
	if unorderedPracticeIDs[ill.ID] {
		sig.Cmp = "unordered"
	}

	var names []string
	methodNames := make(map[string][]string)
	if sig.Cls != "" {
		names = []string{"operations", "arguments"}
		for _, m := range sig.Methods {
			_, mns, _, _, err := ExtractPythonMethodParams(pyCode, m.Name)
			if err != nil {
				return 0, 0, fmt.Errorf("%d: %w", ill.ID, err)
			}
			methodNames[m.Name] = mns
		}
	} else {
		_, pns, _, _, err := ExtractPythonMethodParams(pyCode, sig.Fn)
		if err != nil {
			return 0, 0, fmt.Errorf("%d: %w", ill.ID, err)
		}
		names = pns
	}

	mdRel, err := FindProblemMarkdownPath(repoRoot, ill.ID)
	if err != nil {
		return 0, 0, err
	}
	mdBytes, err := os.ReadFile(filepath.Join(repoRoot, mdRel))
	if err != nil {
		return 0, 0, fmt.Errorf("read %s: %w", mdRel, err)
	}
	officialExamples, constraints, err := ParseProblemMarkdownExamples(mdRel, string(mdBytes))
	if err != nil {
		return 0, 0, fmt.Errorf("%d: %w", ill.ID, err)
	}
	if len(officialExamples) == 0 {
		return 0, 0, fmt.Errorf("%d: missing official examples in %s", ill.ID, mdRel)
	}

	type rawInputItem struct {
		input []any
		label string
		quick bool
	}
	var inputs []rawInputItem
	seenIdx := make(map[string]int)
	addInput := func(val []any, label string, quick bool) error {
		kb, err := MarshalJSONNoEscape(val)
		if err != nil {
			return err
		}
		key := string(kb)
		if idx, exists := seenIdx[key]; exists {
			if strings.HasPrefix(label, "边界") {
				inputs[idx].label += " · 边界"
			}
			if quick {
				inputs[idx].quick = true
			}
			return nil
		}
		seenIdx[key] = len(inputs)
		inputs = append(inputs, rawInputItem{input: val, label: label, quick: quick})
		return nil
	}

	officialInputs := make([][]any, len(officialExamples))
	officialKeys := make([]string, len(officialExamples))
	for i, ex := range officialExamples {
		inVal, err := OfficialExampleInput(ill.ID, sig, ex)
		if err != nil {
			return 0, 0, err
		}
		officialInputs[i] = inVal
		kb, _ := MarshalJSONNoEscape(inVal)
		officialKeys[i] = string(kb)
		if err := addInput(inVal, fmt.Sprintf("示例 %d", ex.Index), true); err != nil {
			return 0, 0, err
		}
	}

	for i, c := range casesFile.Cases {
		arr, ok := c.In.([]any)
		if !ok {
			return 0, 0, fmt.Errorf("%d: case %d input is not a JSON array", ill.ID, i)
		}
		if err := addInput(arr, fmt.Sprintf("仓库判题用例 %d", i+1), i < casesFile.Fixed); err != nil {
			return 0, 0, err
		}
	}

	for i, bc := range bounds {
		var bcArr []any
		if err := json.Unmarshal(bc, &bcArr); err != nil {
			return 0, 0, fmt.Errorf("%d: boundary %d is not a JSON array: %w", ill.ID, i, err)
		}
		if err := addInput(bcArr, fmt.Sprintf("边界用例 %d", i+1), true); err != nil {
			return 0, 0, err
		}
	}

	allInputs := make([]any, len(inputs))
	for i, item := range inputs {
		allInputs[i] = item.input
	}
	norm, err := NormSig(sig)
	if err != nil {
		return 0, 0, fmt.Errorf("%d: %w", ill.ID, err)
	}
	expected, err := RunPythonCasesSync(ctx, repoRoot, pad4, norm, allInputs, pyCode)
	if err != nil {
		return 0, 0, fmt.Errorf("%d: run python reference: %w", ill.ID, err)
	}
	if len(expected) != len(inputs) {
		return 0, 0, fmt.Errorf("%d: python returned %d outputs for %d inputs", ill.ID, len(expected), len(inputs))
	}

	examples := make([]PracticeCase, len(officialExamples))
	exByKey := make(map[string]PracticeCase, len(officialExamples))
	for i, ex := range officialExamples {
		out, err := OfficialExampleExpected(ill.ID, ex)
		if err != nil {
			return 0, 0, err
		}
		inVal := officialInputs[i]
		actual := expected[seenIdx[officialKeys[i]]]
		if !ComparePracticeOutput(ill.ID, sig, inVal, out, actual) {
			ab, _ := MarshalJSONNoEscape(actual)
			eb, _ := MarshalJSONNoEscape(out)
			return 0, 0, fmt.Errorf("%d official example %d: reference disagrees with statement: %s vs %s", ill.ID, ex.Index, string(ab), string(eb))
		}
		stdin := EncodeAcmInput(inVal, sig)
		stdout := EncodeAcmOutput(out, sig)
		pc := PracticeCase{
			Input:    inVal,
			Expected: out,
			Stdin:    stdin,
			Stdout:   stdout,
			Label:    fmt.Sprintf("示例 %d", ex.Index),
			Source: &PracticeExampleSource{
				Path:   ex.Path,
				Index:  ex.Index,
				Input:  ex.InputText,
				Output: ex.OutputText,
			},
		}
		examples[i] = pc
		exByKey[officialKeys[i]] = pc
	}

	cases := make([]PracticeCase, len(inputs))
	for i, item := range inputs {
		kb, _ := MarshalJSONNoEscape(item.input)
		key := string(kb)
		if exCase, isEx := exByKey[key]; isEx {
			exCase.Label = item.label
			exCase.Quick = item.quick
			cases[i] = exCase
		} else {
			stdin := EncodeAcmInput(item.input, sig)
			stdout := EncodeAcmOutput(expected[i], sig)
			cases[i] = PracticeCase{
				Input:    item.input,
				Label:    item.label,
				Quick:    item.quick,
				Expected: expected[i],
				Stdin:    stdin,
				Stdout:   stdout,
			}
		}

		// Roundtrip codec parity check identical to build.cjs lines 211-214.
		decIn, err := DecodeAcmInput(cases[i].Stdin, sig)
		if err != nil {
			return 0, 0, fmt.Errorf("%d: decode stdin (%s): %w", ill.ID, item.label, err)
		}
		decInB, _ := MarshalJSONNoEscape(decIn)
		origInB, _ := MarshalJSONNoEscape(cases[i].Input)
		if string(decInB) != string(origInB) {
			return 0, 0, fmt.Errorf("%d: input codec roundtrip failed (%s): %s != %s", ill.ID, item.label, string(decInB), string(origInB))
		}
		decOut, err := ParseAcmOutput(cases[i].Stdout, sig)
		if err != nil {
			return 0, 0, fmt.Errorf("%d: parse stdout (%s): %w", ill.ID, item.label, err)
		}
		decOutB, _ := MarshalJSONNoEscape(decOut)
		origOutB, _ := MarshalJSONNoEscape(cases[i].Expected)
		if string(decOutB) != string(origOutB) {
			return 0, 0, fmt.Errorf("%d: output codec roundtrip failed (%s): %s != %s", ill.ID, item.label, string(decOutB), string(origOutB))
		}
	}

	cloudSet := make(map[string]bool, len(CloudLangs))
	for _, l := range CloudLangs {
		cloudSet[l] = true
	}

	lcStarters := make(map[string]string, len(PracticeLangs))
	acmStarters := make(map[string]string, len(PracticeLangs))
	for _, lang := range PracticeLangs {
		acmStarters[lang] = ""
		if cloudSet[lang] {
			code, err := CloudStarter(ill.ID, sig, lang, leetcodeStarters)
			if err != nil {
				return 0, 0, err
			}
			lcStarters[lang] = code
		} else {
			lcStarters[lang] = LeetcodeTemplate(sig, names, lang, methodNames)
		}
	}

	legacyHashes := make(map[string]string, len(BrowserLangs))
	prevAcmHashes := make(map[string][]string, len(BrowserLangs))
	prevLcHashes := make(map[string][]string, len(BrowserLangs))
	for _, lang := range BrowserLangs {
		legacyHashes[lang] = StarterHash(LegacyAcmTemplate(sig, names, lang))
		prevAcmHashes[lang] = []string{StarterHash(PreviousAcmTemplate(lang))}
		prevLcHashes[lang] = []string{StarterHash(PreviousLeetcodeTemplate(sig, names, lang, methodNames))}
	}

	acmStmt, err := BuildAcmStatement(ill.ID, sig, names, examples, methodNames, desc, constraints, unorderedPracticeIDs)
	if err != nil {
		return 0, 0, fmt.Errorf("%d: acm statement: %w", ill.ID, err)
	}

	doc := PracticeProblem{
		ID:                            ill.ID,
		Name:                          ill.Name,
		Signature:                     sig,
		ParameterNames:                names,
		Starters:                      map[string]map[string]string{"leetcode": lcStarters, "acm": acmStarters},
		LeetcodeUnavailable:           LeetcodeUnavailable(ill.ID),
		LegacyAcmStarterHashes:        legacyHashes,
		Cases:                         cases,
		Examples:                      examples,
		Acm:                           acmStmt,
		PreviousAcmStarterHashes:      prevAcmHashes,
		PreviousLeetcodeStarterHashes: prevLcHashes,
	}

	outBytes, err := MarshalIndentNoEscape(doc, "", "  ")
	if err != nil {
		return 0, 0, err
	}
	outBytes = append(outBytes, '\n')
	if err := os.WriteFile(filepath.Join(outDir, pad4+".json"), outBytes, 0o644); err != nil {
		return 0, 0, err
	}
	return len(cases), len(examples), nil
}
