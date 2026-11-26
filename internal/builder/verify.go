package builder

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/Hanwen-Jiang/coding-dance/internal/conc"
)

type VerifyReport struct {
	ProblemsChecked int   `json:"problemsChecked"`
	TopicsChecked   int   `json:"topicsChecked"`
	CodeFilesParsed int64 `json:"codeFilesParsed"`
	TotalCases      int64 `json:"totalCases"`
}

type illustrationData struct {
	ID          int             `json:"id"`
	Name        string          `json:"name"`
	Level       string          `json:"level"`
	Topic       string          `json:"topic"`
	H1          string          `json:"h1"`
	Lede        string          `json:"lede"`
	Handwritten bool            `json:"handwritten"`
	Hints       json.RawMessage `json:"hints"`
	Points      json.RawMessage `json:"points"`
	Codes       []codeDataEntry `json:"codes"`
	Demo        *struct {
		Presets json.RawMessage `json:"presets"`
	} `json:"demo"`
}

type codeDataEntry struct {
	T     string                  `json:"t"`
	Kind  *string                 `json:"kind"`
	Note  *string                 `json:"note"`
	Key   string                  `json:"key"`
	Code  string                  `json:"code"`
	Marks map[string][]int        `json:"marks"`
	Langs map[string]ParsedCode   `json:"langs"`
}

type casesFile struct {
	Sig   json.RawMessage   `json:"sig"`
	Fixed int               `json:"fixed"`
	Cases []json.RawMessage `json:"cases"`
}

type practiceFile struct {
	ID       int                        `json:"id"`
	Name     string                     `json:"name"`
	Examples []json.RawMessage          `json:"examples"`
	Cases    []json.RawMessage          `json:"cases"`
	Starters map[string]map[string]string `json:"starters"`
}

type topicFile struct {
	Slug     string          `json:"slug"`
	Name     string          `json:"name"`
	Kind     string          `json:"kind"`
	Order    int             `json:"order"`
	Related  []int           `json:"related"`
	Sections []topicSection  `json:"sections"`
}

type topicSection struct {
	Key   string          `json:"key"`
	T     string          `json:"t"`
	Codes []codeDataEntry `json:"codes"`
}

var topicSlugQuoteRe = regexp.MustCompile(`"([\w-]+)"`)

// VerifyWorkspace concurrently verifies all 100 Hot 100 problems and 22 foundational topics:
// - #@tag / //@tag extraction & cross-language mark parity against raw code files
// - cases/<pad4>.json & practice/data/<pad4>.json completeness (all 15 cloud/browser starter templates)
// - foundational topic slug registry sync with site/lib/topic-slugs.ts
func VerifyWorkspace(ctx context.Context, repoRoot string, workers int) (VerifyReport, error) {
	if workers <= 0 {
		workers = runtime.NumCPU()
	}
	illDir := filepath.Join(repoRoot, "tools", "illustrations")
	dataDir := filepath.Join(illDir, "data")
	codeDir := filepath.Join(illDir, "code")
	casesDir := filepath.Join(illDir, "cases")
	pracDir := filepath.Join(repoRoot, "tools", "practice", "data")
	probDocDir := filepath.Join(repoRoot, "problems")

	dataEntries, err := os.ReadDir(dataDir)
	if err != nil {
		return VerifyReport{}, fmt.Errorf("读取 %s 失败: %w", dataDir, err)
	}
	var probFiles []string
	hotIDs := make(map[int]struct{})
	for _, e := range dataEntries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		base := strings.TrimSuffix(e.Name(), ".json")
		if id, err := strconv.Atoi(base); err == nil && len(base) == 4 {
			probFiles = append(probFiles, e.Name())
			hotIDs[id] = struct{}{}
		}
	}
	sort.Strings(probFiles)

	topicDir := filepath.Join(dataDir, "topics")
	var topicFiles []string
	if tEntries, err := os.ReadDir(topicDir); err == nil {
		for _, e := range tEntries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") && e.Name() != "index.json" {
				topicFiles = append(topicFiles, e.Name())
			}
		}
	}
	sort.Strings(topicFiles)

	// Verify topic-slugs.ts matches topics list
	slugsTS := filepath.Join(repoRoot, "site", "lib", "topic-slugs.ts")
	if rawSlugs, err := os.ReadFile(slugsTS); err == nil && len(topicFiles) > 0 {
		var listed []string
		for _, m := range topicSlugQuoteRe.FindAllStringSubmatch(string(rawSlugs), -1) {
			listed = append(listed, m[1])
		}
		sort.Strings(listed)
		var actual []string
		for _, tf := range topicFiles {
			actual = append(actual, strings.TrimSuffix(tf, ".json"))
		}
		sort.Strings(actual)
		if !slices.Equal(listed, actual) {
			return VerifyReport{}, fmt.Errorf("site/lib/topic-slugs.ts (%v) 与 topics (%v) 不一致", listed, actual)
		}
	}

	var parsedFiles atomic.Int64
	var totalCases atomic.Int64

	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)

	for _, fname := range probFiles {
		fname := fname
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			pad4 := strings.TrimSuffix(fname, ".json")
			rawData, err := os.ReadFile(filepath.Join(dataDir, fname))
			if err != nil {
				return err
			}
			var ill illustrationData
			if err := json.Unmarshal(rawData, &ill); err != nil {
				return fmt.Errorf("解析 data/%s 失败: %w", fname, err)
			}

			// 1. Check markdown problem doc exists
			mdName := fmt.Sprintf("%s.%s.md", pad4, ill.Name)
			if _, err := os.Stat(filepath.Join(probDocDir, mdName)); err != nil {
				return fmt.Errorf("缺失题面文档 problems/%s", mdName)
			}

			// 2. Re-parse every raw multi-lang code file & verify //@tag parity and stripped output
			for idx, ce := range ill.Codes {
				key := ce.Key
				if key == "" && idx == 0 {
					key = "std"
				}
				if key == "" {
					continue
				}
				for _, fl := range FileLangs {
					srcFile := filepath.Join(codeDir, pad4, key+"."+fl.Ext)
					rawSrc, err := os.ReadFile(srcFile)
					if err != nil {
						continue
					}
					parsedFiles.Add(1)
					parsed, mismatch := CheckMarkParity(ce.Marks, fl.ID, string(rawSrc))
					if mismatch != "" {
						return fmt.Errorf("题目 %s [%s]: %s", pad4, key, mismatch)
					}
					if exported, ok := ce.Langs[fl.ID]; ok {
						if exported.Code != parsed.Code {
							return fmt.Errorf("题目 %s [%s.%s]: data JSON 中的代码与源码去标记结果不一致", pad4, key, fl.Ext)
						}
						if !marksEqual(exported.Marks, parsed.Marks) {
							return fmt.Errorf("题目 %s [%s.%s]: data JSON 中的 marks 行号与源码不一致", pad4, key, fl.Ext)
						}
					}
				}
			}

			// 3. Verify cases/<pad4>.json
			cRaw, err := os.ReadFile(filepath.Join(casesDir, fname))
			if err != nil {
				return fmt.Errorf("缺失判题用例 cases/%s: %w", fname, err)
			}
			var cf casesFile
			if err := json.Unmarshal(cRaw, &cf); err != nil || len(cf.Cases) == 0 || cf.Fixed < 0 || cf.Fixed > len(cf.Cases) {
				return fmt.Errorf("cases/%s 用例结构不合法", fname)
			}
			totalCases.Add(int64(len(cf.Cases)))

			// 4. Verify practice/data/<pad4>.json
			pRaw, err := os.ReadFile(filepath.Join(pracDir, fname))
			if err != nil {
				return fmt.Errorf("缺失练习数据 practice/data/%s: %w", fname, err)
			}
			var pf practiceFile
			if err := json.Unmarshal(pRaw, &pf); err != nil || pf.ID != ill.ID || len(pf.Examples) == 0 || len(pf.Cases) == 0 {
				return fmt.Errorf("practice/data/%s 内容不完整", fname)
			}
			if len(pf.Starters["leetcode"]) < 15 || len(pf.Starters["acm"]) < 15 {
				return fmt.Errorf("practice/data/%s 缺少 15 语言起始代码模板", fname)
			}
			return nil
		})
	}

	for _, tfName := range topicFiles {
		tfName := tfName
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			rawT, err := os.ReadFile(filepath.Join(topicDir, tfName))
			if err != nil {
				return err
			}
			var tf topicFile
			if err := json.Unmarshal(rawT, &tf); err != nil {
				return fmt.Errorf("解析专题 %s 失败: %w", tfName, err)
			}
			for _, rel := range tf.Related {
				if _, ok := hotIDs[rel]; !ok {
					return fmt.Errorf("专题 %s 的 related 题号 %d 不在热题 100 中", tf.Slug, rel)
				}
			}
			for _, sec := range tf.Sections {
				for idx, ce := range sec.Codes {
					key := ce.Key
					if key == "" && idx == 0 {
						key = sec.Key
					}
					if key == "" {
						continue
					}
					for _, fl := range FileLangs {
						srcFile := filepath.Join(codeDir, "topics", tf.Slug, key+"."+fl.Ext)
						rawSrc, err := os.ReadFile(srcFile)
						if err != nil {
							continue
						}
						parsedFiles.Add(1)
						parsed, mismatch := CheckMarkParity(ce.Marks, fl.ID, string(rawSrc))
						if mismatch != "" {
							return fmt.Errorf("专题 %s/%s [%s]: %s", tf.Slug, sec.Key, key, mismatch)
						}
						if exported, ok := ce.Langs[fl.ID]; ok && exported.Code != parsed.Code {
							return fmt.Errorf("专题 %s/%s [%s.%s]: 代码与去标记结果不一致", tf.Slug, sec.Key, key, fl.Ext)
						}
					}
				}
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return VerifyReport{}, err
	}
	return VerifyReport{
		ProblemsChecked: len(probFiles),
		TopicsChecked:   len(topicFiles),
		CodeFilesParsed: parsedFiles.Load(),
		TotalCases:      totalCases.Load(),
	}, nil
}

func marksEqual(a, b map[string][]int) bool {
	if len(a) != len(b) {
		return false
	}
	for k, va := range a {
		if !slices.Equal(va, b[k]) {
			return false
		}
	}
	return true
}

// DeclarativeProblemContract matches contracts/schema/problem.schema.json.
type DeclarativeProblemContract struct {
	ID             int                   `json:"id"`
	Name           string                `json:"name"`
	Level          string                `json:"level"`
	Topic          string                `json:"topic"`
	H1             string                `json:"h1"`
	Lede           string                `json:"lede"`
	Handwritten    bool                  `json:"handwritten,omitempty"`
	Sig            json.RawMessage       `json:"sig"`
	Hints          json.RawMessage       `json:"hints"`
	Points         json.RawMessage       `json:"points"`
	Presets        json.RawMessage       `json:"presets,omitempty"`
	FixedCases     int                   `json:"fixedCases"`
	ACMDescription string                `json:"acmDescription,omitempty"`
	Boundaries     []json.RawMessage     `json:"boundaries,omitempty"`
	CodeEntries    []ContractCodeEntry   `json:"codeEntries"`
}

type practiceMetaContract struct {
	Version      int                        `json:"version"`
	Descriptions map[string]string          `json:"descriptions"`
	Boundaries   map[string][]json.RawMessage `json:"boundaries"`
}

func loadPracticeMeta(repoRoot string) (practiceMetaContract, error) {
	var meta practiceMetaContract
	raw, err := os.ReadFile(filepath.Join(repoRoot, "contracts", "practice-meta.json"))
	if err != nil {
		return meta, fmt.Errorf("read contracts/practice-meta.json: %w", err)
	}
	if err := json.Unmarshal(raw, &meta); err != nil {
		return meta, fmt.Errorf("parse contracts/practice-meta.json: %w", err)
	}
	return meta, nil
}

type ContractCodeEntry struct {
	Key   string            `json:"key"`
	Title string            `json:"title"`
	Kind  *string           `json:"kind,omitempty"`
	Note  *string           `json:"note,omitempty"`
	Files map[string]string `json:"files"`
}

// ExportContracts extracts pure declarative JSON contracts for all problems concurrently.
func ExportContracts(ctx context.Context, repoRoot, outDir string, workers int) (int, error) {
	if workers <= 0 {
		workers = runtime.NumCPU()
	}
	illDir := filepath.Join(repoRoot, "tools", "illustrations")
	dataDir := filepath.Join(illDir, "data")
	casesDir := filepath.Join(illDir, "cases")
	codeDir := filepath.Join(illDir, "code")
	probOut := filepath.Join(outDir, "problems")
	if err := os.MkdirAll(probOut, 0o755); err != nil {
		return 0, err
	}

	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return 0, err
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && len(e.Name()) == 9 && strings.HasSuffix(e.Name(), ".json") {
			files = append(files, e.Name())
		}
	}

	var meta practiceMetaContract
	if rawMeta, err := os.ReadFile(filepath.Join(repoRoot, "contracts", "practice-meta.json")); err == nil {
		_ = json.Unmarshal(rawMeta, &meta)
	}

	g, gCtx := conc.WithContext(ctx)
	g.SetLimit(workers)
	for _, fname := range files {
		fname := fname
		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}
			pad4 := strings.TrimSuffix(fname, ".json")
			rawD, err := os.ReadFile(filepath.Join(dataDir, fname))
			if err != nil {
				return err
			}
			var ill illustrationData
			if err := json.Unmarshal(rawD, &ill); err != nil {
				return err
			}
			rawC, err := os.ReadFile(filepath.Join(casesDir, fname))
			if err != nil {
				return err
			}
			var cf casesFile
			if err := json.Unmarshal(rawC, &cf); err != nil {
				return err
			}

			var cEntries []ContractCodeEntry
			for idx, ce := range ill.Codes {
				key := ce.Key
				if key == "" {
					if idx == 0 {
						key = "std"
					} else {
						key = fmt.Sprintf("alt-%d", idx)
					}
				}
				fmap := map[string]string{
					"python": fmt.Sprintf("tools/illustrations/specs/%s.js#%s", pad4, key),
				}
				for _, fl := range FileLangs {
					rel := filepath.ToSlash(filepath.Join("tools/illustrations/code", pad4, key+"."+fl.Ext))
					if _, err := os.Stat(filepath.Join(codeDir, pad4, key+"."+fl.Ext)); err == nil {
						fmap[fl.ID] = rel
					}
				}
				cEntries = append(cEntries, ContractCodeEntry{
					Key:   key,
					Title: ce.T,
					Kind:  ce.Kind,
					Note:  ce.Note,
					Files: fmap,
				})
			}

			var presets json.RawMessage
			if ill.Demo != nil {
				presets = ill.Demo.Presets
			}
			idStr := strconv.Itoa(ill.ID)
			contract := DeclarativeProblemContract{
				ID:             ill.ID,
				Name:           ill.Name,
				Level:          ill.Level,
				Topic:          ill.Topic,
				H1:             ill.H1,
				Lede:           ill.Lede,
				Handwritten:    ill.Handwritten,
				Sig:            cf.Sig,
				Hints:          ill.Hints,
				Points:         ill.Points,
				Presets:        presets,
				FixedCases:     cf.Fixed,
				ACMDescription: meta.Descriptions[idStr],
				Boundaries:     meta.Boundaries[idStr],
				CodeEntries:    cEntries,
			}
			encoded, err := json.MarshalIndent(contract, "", "  ")
			if err != nil {
				return err
			}
			return os.WriteFile(filepath.Join(probOut, fname), append(encoded, '\n'), 0o644)
		})
	}
	if err := g.Wait(); err != nil {
		return 0, err
	}
	return len(files), nil
}
