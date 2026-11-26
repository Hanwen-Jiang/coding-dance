package builder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"

	"github.com/Hanwen-Jiang/coding-dance/internal/conc"
)

type BuildOptions struct {
	Workers   int
	Strict    bool
	Quick     bool
	BundleOut string
}

type topicIndexSection struct {
	Key  string `json:"key"`
	T    string `json:"t"`
	Demo bool   `json:"demo"`
}

type topicIndexEntry struct {
	Slug     string              `json:"slug"`
	Name     string              `json:"name"`
	Kind     string              `json:"kind"`
	Order    int                 `json:"order"`
	Lede     string              `json:"lede"`
	Related  []int               `json:"related"`
	Sections []topicIndexSection `json:"sections"`
}

type fullTopicFile struct {
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Order    int    `json:"order"`
	Lede     string `json:"lede"`
	Related  []int  `json:"related"`
	Sections []struct {
		Key  string          `json:"key"`
		T    string          `json:"t"`
		Demo json.RawMessage `json:"demo"`
	} `json:"sections"`
}

var reQuotedSlug = regexp.MustCompile(`"([\w-]+)"`)

// BuildWorkspace replaces sequential JS/Python generation with Go-orchestrated sharded illustration builds,
// unified topics/index.json emission, concurrent pure-Go 100-problem practice data generation, and optional R2 bundling.
func BuildWorkspace(ctx context.Context, repoRoot string, opts BuildOptions) error {
	workers := opts.Workers
	if workers <= 0 {
		workers = runtime.GOMAXPROCS(0)
	}

	if err := runShardedIllustrationsBuild(ctx, repoRoot, workers, opts.Strict, opts.Quick); err != nil {
		return err
	}
	if err := buildTopicsIndex(repoRoot); err != nil {
		return err
	}

	casesTotal, examplesTotal, err := BuildPracticeData(ctx, repoRoot, workers)
	if err != nil {
		return fmt.Errorf("practice build: %w", err)
	}
	fmt.Printf("Built 100 practice problems (%d official examples, %d cases) across %d workers\n", examplesTotal, casesTotal, workers)

	if opts.BundleOut != "" {
		outDir := opts.BundleOut
		if !filepath.IsAbs(outDir) {
			outDir = filepath.Join(repoRoot, outDir)
		}
		manifest, err := BundleR2Artifacts(ctx, repoRoot, outDir, workers)
		if err != nil {
			return fmt.Errorf("bundle r2: %w", err)
		}
		fmt.Printf("Bundled R2 artifacts (%d problems, %d practice, %d topics, %d bytes) -> %s (version=%d)\n",
			len(manifest.Problems), len(manifest.Practice), len(manifest.Topics), manifest.TotalBytes, outDir, manifest.Version)
	}
	return nil
}

func runShardedIllustrationsBuild(ctx context.Context, repoRoot string, workers int, strict, quick bool) error {
	specEntries, err := os.ReadDir(filepath.Join(repoRoot, "tools", "illustrations", "specs"))
	if err != nil {
		return fmt.Errorf("read specs: %w", err)
	}
	var specTargets []string
	for _, e := range specEntries {
		if reFourDigitSpec.MatchString(e.Name()) {
			specTargets = append(specTargets, strings.TrimSuffix(e.Name(), ".js"))
		}
	}
	var topicTargets []string
	topicDir := filepath.Join(repoRoot, "tools", "illustrations", "topics")
	if entries, err := os.ReadDir(topicDir); err == nil {
		for _, e := range entries {
			if strings.HasSuffix(e.Name(), ".js") {
				topicTargets = append(topicTargets, strings.TrimSuffix(e.Name(), ".js"))
			}
		}
	}
	sort.Strings(specTargets)
	sort.Strings(topicTargets)
	if len(specTargets) == 0 && len(topicTargets) == 0 {
		return fmt.Errorf("no illustration specs or topics found")
	}

	// Pre-create output directories so concurrent Node shards never race on mkdirSync.
	for _, sub := range []string{
		filepath.Join("tools", "illustrations", "data", "topics"),
		filepath.Join("tools", "illustrations", "cases", "topics"),
	} {
		if err := os.MkdirAll(filepath.Join(repoRoot, sub), 0o755); err != nil {
			return err
		}
	}

	// Keep spec targets and topic targets in separate build.js invocations:
	// build.js sets wantSpecs = (onlyTopics.length === 0), so mixing both skips specs!
	var shards [][]string
	splitInto := func(items []string, n int) {
		if len(items) == 0 {
			return
		}
		if n > len(items) {
			n = len(items)
		}
		bins := make([][]string, n)
		for i, item := range items {
			bins[i%n] = append(bins[i%n], item)
		}
		shards = append(shards, bins...)
	}
	splitInto(specTargets, workers)
	topicShards := workers / 2
	if topicShards < 1 {
		topicShards = 1
	}
	splitInto(topicTargets, topicShards)

	g, gctx := conc.WithContext(ctx)
	g.SetLimit(workers)
	buildScript := filepath.Join(repoRoot, "tools", "illustrations", "build.js")

	for idx, shard := range shards {
		idx, shard := idx, shard
		g.Go(func() error {
			args := []string{buildScript, "--no-topic-index"}
			if strict {
				args = append(args, "--strict")
			}
			if quick {
				args = append(args, "--quick")
			}
			args = append(args, shard...)

			cmd := exec.CommandContext(gctx, "node", args...)
			cmd.Dir = repoRoot
			var out bytes.Buffer
			cmd.Stdout = &out
			cmd.Stderr = &out
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("illustrations shard %d failed (%v): %s", idx, err, strings.TrimSpace(out.String()))
			}
			return nil
		})
	}
	return g.Wait()
}

func buildTopicsIndex(repoRoot string) error {
	tdir := filepath.Join(repoRoot, "tools", "illustrations", "data", "topics")
	entries, err := os.ReadDir(tdir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}

	var index []topicIndexEntry
	var slugs []string
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".json") || e.Name() == "index.json" {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(tdir, e.Name()))
		if err != nil {
			return err
		}
		var t fullTopicFile
		if err := json.Unmarshal(raw, &t); err != nil {
			return fmt.Errorf("parse %s: %w", e.Name(), err)
		}
		related := t.Related
		if related == nil {
			related = []int{}
		}
		secs := make([]topicIndexSection, len(t.Sections))
		for i, s := range t.Sections {
			demoTrim := strings.TrimSpace(string(s.Demo))
			secs[i] = topicIndexSection{
				Key:  s.Key,
				T:    s.T,
				Demo: demoTrim != "" && demoTrim != "null",
			}
		}
		index = append(index, topicIndexEntry{
			Slug:     t.Slug,
			Name:     t.Name,
			Kind:     t.Kind,
			Order:    t.Order,
			Lede:     t.Lede,
			Related:  related,
			Sections: secs,
		})
		slugs = append(slugs, t.Slug)
	}

	sort.Slice(index, func(i, j int) bool {
		if index[i].Kind == index[j].Kind {
			return index[i].Order < index[j].Order
		}
		return index[i].Kind == "ds"
	})

	data, err := MarshalIndentNoEscape(index, "", " ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	if err := os.WriteFile(filepath.Join(tdir, "index.json"), data, 0o644); err != nil {
		return err
	}

	slugsFile := filepath.Join(repoRoot, "site", "lib", "topic-slugs.ts")
	if rawSlugs, err := os.ReadFile(slugsFile); err == nil {
		var listed []string
		for _, m := range reQuotedSlug.FindAllStringSubmatch(string(rawSlugs), -1) {
			listed = append(listed, m[1])
		}
		sort.Strings(listed)
		sort.Strings(slugs)
		if strings.Join(listed, ",") != strings.Join(slugs, ",") {
			return fmt.Errorf("site/lib/topic-slugs.ts 里的专题列表与 topics/ 不一致: [%s] vs [%s]", strings.Join(listed, ","), strings.Join(slugs, ","))
		}
	}
	return nil
}
