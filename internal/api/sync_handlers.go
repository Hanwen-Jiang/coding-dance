package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/Hanwen-Jiang/coding-dance/internal/conc"
	"github.com/Hanwen-Jiang/coding-dance/internal/progress"
)

var shaHex40Re = regexp.MustCompile(`^[0-9a-f]{40}$`)

func (s *Server) handleSolutions(w http.ResponseWriter, r *http.Request) {
	sess, _, _, ok := s.requireAuth(w, r, false)
	if !ok {
		return
	}
	rawID := strings.TrimPrefix(r.URL.Path, "/api/solutions/")
	id, err := strconv.Atoi(rawID)
	if err != nil || id <= 0 {
		writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "题号不对"})
		return
	}
	if hErr := s.Hydrator.EnsureHydrated(r.Context(), sess); hErr != nil {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": hErr.Error()})
		return
	}
	res, err := s.Store.LoadProblemHistory(r.Context(), sess.Login, id)
	if err != nil {
		writePrivateJSON(w, http.StatusInternalServerError, map[string]any{"error": "读取题解失败"})
		return
	}
	writePrivateJSON(w, http.StatusOK, res)
}

func (s *Server) handleSyncRepo(w http.ResponseWriter, r *http.Request) {
	sess, repo, _, ok := s.requireAuth(w, r, false)
	if !ok {
		return
	}
	st, raw, err := s.ghRequest(r.Context(), sess.Token, http.MethodGet, "/repos/"+repo, nil)
	if err != nil {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": "连不上 GitHub"})
		return
	}
	if st == http.StatusNotFound {
		writePrivateJSON(w, http.StatusNotFound, map[string]any{"error": "找不到你的进度仓，或者还没有授权网站读写它"})
		return
	}
	if st >= 400 {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("GitHub 返回 %d", st)})
		return
	}
	var repoInfo struct {
		DefaultBranch string `json:"default_branch"`
	}
	_ = json.Unmarshal(raw, &repoInfo)
	branch := repoInfo.DefaultBranch
	if branch == "" {
		branch = "main"
	}

	rSt, rRaw, rErr := s.ghRequest(r.Context(), sess.Token, http.MethodGet, "/repos/"+repo+"/git/ref/heads/"+url.PathEscape(branch), nil)
	if rErr != nil || rSt >= 400 {
		writePrivateJSON(w, http.StatusConflict, map[string]any{"error": "进度仓还是空的：先用模板建好仓库"})
		return
	}
	var refInfo struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	_ = json.Unmarshal(rRaw, &refInfo)
	commitSHA := refInfo.Object.SHA

	cSt, cRaw, cErr := s.ghRequest(r.Context(), sess.Token, http.MethodGet, "/repos/"+repo+"/git/commits/"+commitSHA, nil)
	if cErr != nil || cSt >= 400 {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("GitHub 返回 %d", cSt)})
		return
	}
	var commitInfo struct {
		Tree struct {
			SHA string `json:"sha"`
		} `json:"tree"`
	}
	_ = json.Unmarshal(cRaw, &commitInfo)

	tSt, tRaw, tErr := s.ghRequest(r.Context(), sess.Token, http.MethodGet, "/repos/"+repo+"/git/trees/"+commitInfo.Tree.SHA+"?recursive=1", nil)
	if tErr != nil || tSt >= 400 {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("GitHub 返回 %d", tSt)})
		return
	}
	var treeInfo struct {
		Truncated bool `json:"truncated"`
		Tree      []struct {
			Path string `json:"path"`
			SHA  string `json:"sha"`
			Type string `json:"type"`
		} `json:"tree"`
	}
	_ = json.Unmarshal(tRaw, &treeInfo)
	if treeInfo.Truncated {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": "仓库文件太多，GitHub 没有一次返回完整的列表"})
		return
	}

	files := make([]map[string]string, 0, len(treeInfo.Tree))
	for _, e := range treeInfo.Tree {
		if e.Type == "blob" {
			files = append(files, map[string]string{"path": e.Path, "sha": e.SHA})
		}
	}
	writePrivateJSON(w, http.StatusOK, map[string]any{
		"repo":   repo,
		"branch": branch,
		"commit": commitSHA,
		"tree":   commitInfo.Tree.SHA,
		"files":  files,
	})
}

func (s *Server) handleSyncBlobs(w http.ResponseWriter, r *http.Request) {
	sess, repo, _, ok := s.requireAuth(w, r, true)
	if !ok {
		return
	}
	var body struct {
		SHAs []string `json:"shas"`
	}
	if json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body) != nil || len(body.SHAs) > 50 {
		writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "参数不对"})
		return
	}
	for _, sha := range body.SHAs {
		if !shaHex40Re.MatchString(sha) {
			writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "参数不对"})
			return
		}
	}

	var mu sync.Mutex
	texts := make(map[string]string, len(body.SHAs))
	grp, gctx := conc.WithContext(r.Context())
	grp.SetLimit(8)
	for _, sha := range body.SHAs {
		sh := sha
		grp.Go(func() error {
			st, raw, err := s.ghRequest(gctx, sess.Token, http.MethodGet, "/repos/"+repo+"/git/blobs/"+sh, nil)
			if err != nil {
				return fmt.Errorf("读不到文件 %s：%w", sh[:7], err)
			}
			if st >= 400 {
				return fmt.Errorf("读不到文件 %s（%d）", sh[:7], st)
			}
			var b struct {
				Encoding string `json:"encoding"`
				Content  string `json:"content"`
			}
			if json.Unmarshal(raw, &b) == nil {
				txt := b.Content
				if b.Encoding == "base64" {
					cleaned := strings.ReplaceAll(strings.ReplaceAll(b.Content, "\n", ""), "\r", "")
					if dec, dErr := base64.StdEncoding.DecodeString(cleaned); dErr == nil {
						txt = string(dec)
					}
				}
				mu.Lock()
				texts[sh] = txt
				mu.Unlock()
			}
			return nil
		})
	}
	if err := grp.Wait(); err != nil {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
		return
	}
	writePrivateJSON(w, http.StatusOK, map[string]any{"texts": texts})
}

func (s *Server) handleSyncCommit(w http.ResponseWriter, r *http.Request) {
	sess, repo, _, ok := s.requireAuth(w, r, true)
	if !ok {
		return
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, 5<<20))
	if err != nil {
		writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "读取请求失败"})
		return
	}
	req, vErr := progress.ValidateSyncWrites(raw)
	if vErr != nil {
		st := http.StatusBadRequest
		if ve, ok := vErr.(*progress.ValidationError); ok && ve.Status > 0 {
			st = ve.Status
		}
		writePrivateJSON(w, st, map[string]any{"error": vErr.Error()})
		return
	}

	treeEntries := make([]map[string]string, len(req.Files))
	for i, f := range req.Files {
		treeEntries[i] = map[string]string{
			"path":    f.Path,
			"mode":    "100644",
			"type":    "blob",
			"content": f.Content,
		}
	}
	tSt, tRaw, tErr := s.ghRequest(r.Context(), sess.Token, http.MethodPost, "/repos/"+repo+"/git/trees", map[string]any{
		"base_tree": req.BaseTree,
		"tree":      treeEntries,
	})
	if tErr != nil || tSt >= 400 {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("GitHub 建 tree 失败（%d）", tSt)})
		return
	}
	var newTree struct {
		SHA string `json:"sha"`
	}
	_ = json.Unmarshal(tRaw, &newTree)

	cSt, cRaw, cErr := s.ghRequest(r.Context(), sess.Token, http.MethodPost, "/repos/"+repo+"/git/commits", map[string]any{
		"message": req.Message,
		"tree":    newTree.SHA,
		"parents": []string{req.Parent},
	})
	if cErr != nil || cSt >= 400 {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("GitHub 建 commit 失败（%d）", cSt)})
		return
	}
	var newCommit struct {
		SHA     string `json:"sha"`
		HTMLURL string `json:"html_url"`
	}
	_ = json.Unmarshal(cRaw, &newCommit)

	rSt, _, rErr := s.ghRequest(r.Context(), sess.Token, http.MethodPatch, "/repos/"+repo+"/git/refs/heads/"+url.PathEscape(req.Branch), map[string]any{
		"sha":   newCommit.SHA,
		"force": false,
	})
	if rErr != nil {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": "GitHub 更新分支失败"})
		return
	}
	if rSt == http.StatusConflict || rSt == http.StatusUnprocessableEntity {
		writePrivateJSON(w, http.StatusConflict, map[string]any{"conflict": true, "error": "仓库在这期间有了新的提交"})
		return
	}
	if rSt >= 400 {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("GitHub 更新分支失败（%d）", rSt)})
		return
	}

	// Keep hot Postgres/memory store consistent immediately with the newly committed sync files.
	_ = s.Hydrator.Rehydrate(r.Context(), sess)
	writePrivateJSON(w, http.StatusOK, map[string]any{"sha": newCommit.SHA, "url": newCommit.HTMLURL})
}

func constantTimeStringEqual(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	ha := sha256.Sum256([]byte(a))
	hb := sha256.Sum256([]byte(b))
	return subtle.ConstantTimeCompare(ha[:], hb[:]) == 1
}

func (s *Server) handleAdminRunner(w http.ResponseWriter, r *http.Request) {
	expected := s.Cfg.AdminToken
	if expected == "" {
		expected = s.Cfg.RunnerSecret
	}
	if expected == "" || !s.Cluster.Configured() {
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "运行器集群尚未配置"})
		return
	}
	auth := r.Header.Get("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	if !strings.HasPrefix(auth, "Bearer ") || !constantTimeStringEqual(token, expected) {
		writePrivateJSON(w, http.StatusUnauthorized, map[string]any{"error": "无权访问集群监控接口"})
		return
	}
	out := s.Cluster.Telemetry(r.Context())
	pending, synced, _ := s.Store.OutboxCounts(r.Context())
	out["outbox"] = map[string]int{"pending": pending, "synced": synced}
	writePrivateJSON(w, http.StatusOK, out)
}
