package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/conc"
	"github.com/Hanwen-Jiang/coding-dance/internal/progress"
)

// Hydrator populates HotStore (Postgres or MemoryStore) on cold start from <user>/hot100-progress
// so returning users see full history with sub-5ms subsequent reads.
type Hydrator struct {
	Store         Store
	GitHubAPIBase string
	ProgressRepo  string
	HTTPClient    *http.Client

	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

func NewHydrator(store Store, ghBase, progressRepo string) *Hydrator {
	if ghBase == "" {
		ghBase = "https://api.github.com"
	}
	return &Hydrator{
		Store:         store,
		GitHubAPIBase: strings.TrimRight(ghBase, "/"),
		ProgressRepo:  progressRepo,
		HTTPClient:    &http.Client{Timeout: 20 * time.Second},
		locks:         make(map[string]*sync.Mutex),
	}
}

func (h *Hydrator) userLock(login string) *sync.Mutex {
	h.mu.Lock()
	defer h.mu.Unlock()
	l := h.locks[login]
	if l == nil {
		l = &sync.Mutex{}
		h.locks[login] = l
	}
	return l
}

func (h *Hydrator) EnsureHydrated(ctx context.Context, sess *Session) error {
	if sess == nil || h.Store == nil {
		return nil
	}
	ok, err := h.Store.IsHydrated(ctx, sess.Login)
	if err == nil && ok {
		return nil
	}
	ul := h.userLock(sess.Login)
	ul.Lock()
	defer ul.Unlock()
	if ok, err := h.Store.IsHydrated(ctx, sess.Login); err == nil && ok {
		return nil
	}
	return h.rehydrateLocked(ctx, sess)
}

func (h *Hydrator) Rehydrate(ctx context.Context, sess *Session) error {
	if sess == nil || h.Store == nil {
		return nil
	}
	ul := h.userLock(sess.Login)
	ul.Lock()
	defer ul.Unlock()
	return h.rehydrateLocked(ctx, sess)
}

func (h *Hydrator) ghGet(ctx context.Context, token, path string) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.GitHubAPIBase+path, nil)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "cd-api-hydrator/1.0")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	resp, err := h.HTTPClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	return resp.StatusCode, raw, err
}

func (h *Hydrator) rehydrateLocked(ctx context.Context, sess *Session) error {
	repo := sess.Login + "/" + h.ProgressRepo
	st, raw, err := h.ghGet(ctx, sess.Token, "/repos/"+repo+"/git/trees/HEAD?recursive=1")
	if err != nil {
		return err
	}
	if st == http.StatusNotFound || st == http.StatusConflict {
		// Repo not created yet or still empty: mark hydrated cleanly with empty state so repeated requests stay fast.
		return h.Store.ReplaceFromHydration(ctx, sess.Login, HydratedRepo{}, time.Now())
	}
	if st >= 400 {
		return fmt.Errorf("读取进度仓目录失败（GitHub %d）", st)
	}

	var treeResp struct {
		Tree []struct {
			Path string `json:"path"`
			Type string `json:"type"`
			SHA  string `json:"sha"`
		} `json:"tree"`
	}
	if err := json.Unmarshal(raw, &treeResp); err != nil {
		return err
	}

	var allPaths []string
	type blobTarget struct {
		path string
		sha  string
	}
	var want []blobTarget
	for _, e := range treeResp.Tree {
		if e.Type != "blob" {
			continue
		}
		allPaths = append(allPaths, e.Path)
		switch {
		case e.Path == "progress.json", e.Path == "settings.json":
			want = append(want, blobTarget{e.Path, e.SHA})
		case strings.HasPrefix(e.Path, "drafts/"), strings.HasPrefix(e.Path, "solutions/"):
			want = append(want, blobTarget{e.Path, e.SHA})
		case strings.HasPrefix(e.Path, "attempts/") && e.Path != "attempts/skip.txt":
			want = append(want, blobTarget{e.Path, e.SHA})
		}
	}

	var mu sync.Mutex
	contents := make(map[string]string, len(want))
	grp, gctx := conc.WithContext(ctx)
	grp.SetLimit(8)
	for _, item := range want {
		it := item
		grp.Go(func() error {
			bst, braw, berr := h.ghGet(gctx, sess.Token, "/repos/"+repo+"/git/blobs/"+it.sha)
			if berr != nil {
				return berr
			}
			if bst >= 400 {
				return fmt.Errorf("读取 %s 失败（GitHub %d）", it.path, bst)
			}
			var blob struct {
				Encoding string `json:"encoding"`
				Content  string `json:"content"`
			}
			if json.Unmarshal(braw, &blob) != nil {
				return nil
			}
			txt := blob.Content
			if blob.Encoding == "base64" {
				cleaned := strings.ReplaceAll(strings.ReplaceAll(blob.Content, "\n", ""), "\r", "")
				if dec, err := base64.StdEncoding.DecodeString(cleaned); err == nil {
					txt = string(dec)
				}
			}
			mu.Lock()
			contents[it.path] = txt
			mu.Unlock()
			return nil
		})
	}
	if err := grp.Wait(); err != nil {
		return err
	}

	out := HydratedRepo{
		Progress: make(map[string]progress.ProgressEntry),
		AllPaths: allPaths,
	}

	if pRaw, ok := contents["progress.json"]; ok {
		var pf progress.ProgressFile
		if json.Unmarshal([]byte(strings.TrimPrefix(pRaw, "\uFEFF")), &pf) == nil {
			for k, v := range pf.Problems {
				if slices.Contains(progress.ValidStatuses, v.Status) {
					out.Progress[k] = v
				}
			}
		}
	}
	if sRaw, ok := contents["settings.json"]; ok {
		var sf progress.SettingsFile
		if json.Unmarshal([]byte(strings.TrimPrefix(sRaw, "\uFEFF")), &sf) == nil {
			out.Settings = progress.CleanLangs(sf.Langs)
		}
	}

	for path, txt := range contents {
		if id, lang, mode, ok := progress.ParseDraftPath(path); ok {
			out.Drafts = append(out.Drafts, DraftSeed{
				ProblemID: id,
				Lang:      lang,
				Mode:      mode,
				FilePath:  path,
				Code:      txt,
			})
			continue
		}
		if id, lang, _, ok := progress.ParseSolutionPath(path); ok {
			out.Solutions = append(out.Solutions, SolutionSeed{
				FilePath:  path,
				ProblemID: id,
				Lang:      lang,
				Code:      txt,
			})
			continue
		}
		if id, date, seq, result, ok := progress.ParseAttemptPath(path); ok {
			attLang, _, _, _, _, _, _, _ := progress.ParseAttemptBody(txt)
			if attLang == "" {
				attLang = "python"
			}
			mode := "leetcode"
			if strings.Contains(txt, "\nmode: acm\n") {
				mode = "acm"
			}
			out.Attempts = append(out.Attempts, AttemptSeed{
				ProblemID: id,
				Date:      date,
				Seq:       seq,
				Result:    result,
				Lang:      attLang,
				Mode:      mode,
				FilePath:  path,
				Markdown:  txt,
			})
		}
	}

	return h.Store.ReplaceFromHydration(ctx, sess.Login, out, time.Now())
}
