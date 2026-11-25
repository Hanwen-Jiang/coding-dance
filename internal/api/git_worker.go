package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/otel"
	"github.com/Hanwen-Jiang/coding-dance/internal/progress"
)

var errGitRefConflict = errors.New("github ref 409/422 conflict")

// GitSyncWorker drains coalesced batches from HotStore's git_sync_outbox and commits
// them atomically to the user's <login>/hot100-progress GitHub repository.
type GitSyncWorker struct {
	Store         *HotStore
	GitHubAPIBase string
	SessionSecret string
	HTTPClient    *http.Client
	PollInterval  time.Duration
	Metrics       *otel.Registry
	LogFn         func(map[string]any)

	wakeCh chan struct{}
}

func NewGitSyncWorker(store *HotStore, ghBase, secret string, metrics *otel.Registry, logFn func(map[string]any)) *GitSyncWorker {
	if ghBase == "" {
		ghBase = "https://api.github.com"
	}
	w := &GitSyncWorker{
		Store:         store,
		GitHubAPIBase: strings.TrimRight(ghBase, "/"),
		SessionSecret: secret,
		HTTPClient:    &http.Client{Timeout: 20 * time.Second},
		PollInterval:  2 * time.Second,
		Metrics:       metrics,
		LogFn:         logFn,
		wakeCh:        make(chan struct{}, 1),
	}
	if metrics != nil && store != nil {
		metrics.RegisterGaugeFunc("cd_api_outbox_pending", func() float64 {
			p, _ := store.OutboxCounts()
			return float64(p)
		})
	}
	return w
}

func (w *GitSyncWorker) Notify() {
	select {
	case w.wakeCh <- struct{}{}:
	default:
	}
}

func (w *GitSyncWorker) Start(ctx context.Context) {
	interval := w.PollInterval
	if interval <= 0 {
		interval = 2 * time.Second
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-w.wakeCh:
				w.FlushReady(ctx)
			case <-ticker.C:
				w.FlushReady(ctx)
			}
		}
	}()
}

// FlushReady drains all currently due batches across users.
func (w *GitSyncWorker) FlushReady(ctx context.Context) {
	for range 32 {
		if ctx.Err() != nil {
			return
		}
		login, repo, sealedTok, items := w.Store.PendingBatchForNextUser(time.Now())
		if len(items) == 0 {
			return
		}
		ids := make([]int64, len(items))
		for i, it := range items {
			ids[i] = it.ID
		}
		var ghToken string
		if err := UnsealData(w.SessionSecret, sealedTok, &ghToken); err != nil || ghToken == "" {
			w.Store.MarkOutboxRetry(ids, "unseal github token failed", 30*time.Second, time.Now())
			continue
		}

		commitSHA, err := w.syncBatchWithRetry(ctx, ghToken, repo, items)
		if err != nil {
			attempt := items[0].Attempts + 1
			backoff := time.Duration(minInt(60, 1<<minInt(attempt, 6))) * time.Second
			w.Store.MarkOutboxRetry(ids, err.Error(), backoff, time.Now())
			if w.Metrics != nil {
				w.Metrics.IncCounter("cd_api_git_sync_total", map[string]string{"status": "retry"})
			}
			if w.LogFn != nil {
				w.LogFn(map[string]any{"event": "git-sync-retry", "user": login, "repo": repo, "error": err.Error(), "items": len(items)})
			}
			continue
		}
		w.Store.MarkOutboxSynced(ids, commitSHA, time.Now())
		if w.Metrics != nil {
			w.Metrics.IncCounter("cd_api_git_sync_total", map[string]string{"status": "ok"})
		}
		if w.LogFn != nil {
			w.LogFn(map[string]any{"event": "git-sync-ok", "user": login, "repo": repo, "commit": commitSHA, "coalescedItems": len(items)})
		}
	}
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (w *GitSyncWorker) syncBatchWithRetry(ctx context.Context, token, repo string, items []OutboxItem) (string, error) {
	// Coalesce multiple updates to the same file path in chronological order (latest content wins!).
	var order []string
	latestContent := make(map[string]string)
	var msgs []string
	seenMsg := make(map[string]struct{})
	for _, it := range items {
		if _, exists := latestContent[it.FilePath]; !exists {
			order = append(order, it.FilePath)
		}
		latestContent[it.FilePath] = it.Content
		if _, dup := seenMsg[it.CommitMsg]; !dup && it.CommitMsg != "" {
			seenMsg[it.CommitMsg] = struct{}{}
			msgs = append(msgs, it.CommitMsg)
		}
	}
	commitMsg := "同步练习进度"
	if len(msgs) == 1 {
		commitMsg = msgs[0]
	} else if len(msgs) > 1 {
		commitMsg = fmt.Sprintf("%s（合并 %d 项更新）", msgs[len(msgs)-1], len(msgs))
	}

	// Retry immediately up to 3 times on 409/422 optimistic SHA conflicts by re-reading HEAD!
	for attempt := range 3 {
		sha, err := w.commitCoalescedOnce(ctx, token, repo, order, latestContent, commitMsg)
		if errors.Is(err, errGitRefConflict) && attempt < 2 {
			continue
		}
		return sha, err
	}
	return "", errGitRefConflict
}

func (w *GitSyncWorker) commitCoalescedOnce(ctx context.Context, token, repo string, order []string, latest map[string]string, message string) (string, error) {
	st, repoInfo, err := w.ghJSON(ctx, token, http.MethodGet, "/repos/"+repo, nil)
	if err != nil {
		return "", err
	}
	if st >= 400 {
		return "", fmt.Errorf("GET /repos/%s status %d", repo, st)
	}
	branch, _ := repoInfo["default_branch"].(string)
	if branch == "" {
		branch = "main"
	}

	st, refInfo, err := w.ghJSON(ctx, token, http.MethodGet, "/repos/"+repo+"/git/ref/heads/"+url.PathEscape(branch), nil)
	if err != nil {
		return "", err
	}
	if st >= 400 {
		return "", fmt.Errorf("GET ref status %d", st)
	}
	refObj, _ := refInfo["object"].(map[string]any)
	parentSHA, _ := refObj["sha"].(string)

	st, commitInfo, err := w.ghJSON(ctx, token, http.MethodGet, "/repos/"+repo+"/git/commits/"+parentSHA, nil)
	if err != nil || st >= 400 {
		return "", fmt.Errorf("GET commit status %d: %v", st, err)
	}
	treeObj, _ := commitInfo["tree"].(map[string]any)
	baseTreeSHA, _ := treeObj["sha"].(string)

	st, treeInfo, err := w.ghJSON(ctx, token, http.MethodGet, "/repos/"+repo+"/git/trees/"+baseTreeSHA+"?recursive=1", nil)
	if err != nil || st >= 400 {
		return "", fmt.Errorf("GET tree status %d: %v", st, err)
	}
	remoteSHAs := make(map[string]string)
	if rawEntries, ok := treeInfo["tree"].([]any); ok {
		for _, e := range rawEntries {
			em, _ := e.(map[string]any)
			if em["type"] == "blob" {
				p, _ := em["path"].(string)
				s, _ := em["sha"].(string)
				remoteSHAs[p] = s
			}
		}
	}

	var treeUpdates []map[string]any
	for _, p := range order {
		content := latest[p]
		if remoteSHAs[p] == progress.GitBlobSHA(content) {
			continue
		}
		treeUpdates = append(treeUpdates, map[string]any{
			"path":    p,
			"mode":    "100644",
			"type":    "blob",
			"content": content,
		})
	}
	if len(treeUpdates) == 0 {
		return parentSHA, nil
	}

	st, newTree, err := w.ghJSON(ctx, token, http.MethodPost, "/repos/"+repo+"/git/trees", map[string]any{
		"base_tree": baseTreeSHA,
		"tree":      treeUpdates,
	})
	if err != nil || st >= 400 {
		return "", fmt.Errorf("POST tree status %d: %v", st, err)
	}
	newTreeSHA, _ := newTree["sha"].(string)

	st, newCommit, err := w.ghJSON(ctx, token, http.MethodPost, "/repos/"+repo+"/git/commits", map[string]any{
		"message": message,
		"tree":    newTreeSHA,
		"parents": []string{parentSHA},
	})
	if err != nil || st >= 400 {
		return "", fmt.Errorf("POST commit status %d: %v", st, err)
	}
	newCommitSHA, _ := newCommit["sha"].(string)

	st, _, err = w.ghJSON(ctx, token, http.MethodPatch, "/repos/"+repo+"/git/refs/heads/"+url.PathEscape(branch), map[string]any{
		"sha":   newCommitSHA,
		"force": false,
	})
	if err != nil {
		return "", err
	}
	if st == http.StatusConflict || st == http.StatusUnprocessableEntity {
		return "", errGitRefConflict
	}
	if st >= 400 {
		return "", fmt.Errorf("PATCH ref status %d", st)
	}
	return newCommitSHA, nil
}

func (w *GitSyncWorker) ghJSON(ctx context.Context, token, method, path string, body any) (int, map[string]any, error) {
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, w.GitHubAPIBase+path, r)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "cd-api-git-worker/1.0")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := w.HTTPClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	var out map[string]any
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return resp.StatusCode, out, nil
}
