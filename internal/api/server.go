package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/otel"
	"github.com/Hanwen-Jiang/coding-dance/internal/progress"
)

type Config struct {
	Host               string
	Port               int
	DatabaseURL        string
	SessionSecret      string
	SiteOrigins        []string
	CookieDomain       string
	GitHubClientID     string
	GitHubClientSecret string
	GitHubAppSlug      string
	GitHubOAuthBase    string
	GitHubAPIBase      string
	ProgressRepo       string
	TemplateRepo       string
	StarRepos          string
	FounderCutoff      string
	RunnerNodes        []RunnerNode
	RunnerSecret       string
	RunnerAccessID     string
	RunnerAccessSecret string
	AdminToken         string
	ValkeyAddr         string
	ValkeyPassword     string
	QuotaFree          int
	QuotaPro           int
	MinAccountDays     int
	FreePaused         bool
	CompanionURL       string
	CompanionToken     string
	WebhookURL         string
	WebhookSecret      string
	ProblemsDir        string
	SnapshotFile       string
	OTLPEndpoint       string
}

func LoadConfigFromEnv() Config {
	str := func(k, def string) string {
		if v := strings.TrimSpace(os.Getenv(k)); v != "" {
			return v
		}
		return def
	}
	num := func(k string, def int) int {
		if v := strings.TrimSpace(os.Getenv(k)); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				return n
			}
		}
		return def
	}
	return Config{
		Host:               str("API_HOST", "127.0.0.1"),
		Port:               num("API_PORT", 8788),
		DatabaseURL:        str("DATABASE_URL", ""),
		SessionSecret:      str("SESSION_SECRET", ""),
		SiteOrigins:        ParseAllowedOrigins(str("SITE_ORIGINS", "https://leetcode.cgent.link,https://codexdance.cn,https://codingdance.cn")),
		CookieDomain:       str("COOKIE_DOMAIN", ""),
		GitHubClientID:     str("GITHUB_APP_CLIENT_ID", ""),
		GitHubClientSecret: str("GITHUB_APP_CLIENT_SECRET", ""),
		GitHubAppSlug:      str("GITHUB_APP_SLUG", "coding-dance"),
		GitHubOAuthBase:    str("GITHUB_OAUTH_BASE", "https://github.com"),
		GitHubAPIBase:      str("SYNC_GITHUB_API", "https://api.github.com"),
		ProgressRepo:       str("PROGRESS_REPO", "hot100-progress"),
		TemplateRepo:       str("TEMPLATE_REPO", "Hanwen-Jiang/hot100-progress-template"),
		StarRepos:          str("STAR_REPOS", ""),
		FounderCutoff:      str("FOUNDER_CUTOFF", "2026-11-18T00:00:00+08:00"),
		RunnerNodes:        ParseRunnerNodes(os.Getenv("RUNNER_NODES")),
		RunnerSecret:       str("RUNNER_SECRET", ""),
		RunnerAccessID:     str("RUNNER_ACCESS_ID", ""),
		RunnerAccessSecret: str("RUNNER_ACCESS_SECRET", ""),
		AdminToken:         str("RUNNER_ADMIN_TOKEN", ""),
		ValkeyAddr:         str("VALKEY_ADDR", ""),
		ValkeyPassword:     str("VALKEY_PASSWORD", ""),
		QuotaFree:          num("CLOUD_QUOTA_FREE", 30),
		QuotaPro:           num("CLOUD_QUOTA_PRO", 2000),
		MinAccountDays:     num("CLOUD_MIN_ACCOUNT_DAYS", 30),
		FreePaused:         os.Getenv("CLOUD_FREE_PAUSED") == "1",
		CompanionURL:       str("CODING_AGENT_URL", ""),
		CompanionToken:     str("CODING_DANCE_API_TOKEN", ""),
		WebhookURL:         str("CODING_DANCE_WEBHOOK_URL", ""),
		WebhookSecret:      str("CODING_DANCE_WEBHOOK_SECRET", ""),
		ProblemsDir:        str("PROBLEMS_DIR", "problems"),
		SnapshotFile:       str("HOT_STORE_SNAPSHOT_FILE", ""),
		OTLPEndpoint:       str("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
	}
}

var problemFileRe = regexp.MustCompile(`^(\d{4})\.(.+)\.md$`)

func LoadProblemsFromDir(dir string) []progress.ProblemMeta {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []progress.ProblemMeta
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		m := problemFileRe.FindStringSubmatch(e.Name())
		if m == nil {
			continue
		}
		id, _ := strconv.Atoi(m[1])
		out = append(out, progress.ProblemMeta{ID: id, Name: filepath.Base(m[2])})
	}
	return out
}

type Server struct {
	Cfg        Config
	Store      Store
	Worker     *GitSyncWorker
	Hydrator   *Hydrator
	Quota      *QuotaManager
	Cluster    *ClusterRouter
	Companion  *CompanionGateway
	Metrics    *otel.Registry
	HTTPClient *http.Client
	ProfileFn  func(sess *Session) QuotaProfile
}

func NewServer(cfg Config, problems []progress.ProblemMeta, kv KVStore, logFn func(map[string]any)) *Server {
	return NewServerWithStore(cfg, problems, nil, kv, logFn)
}

func NewServerWithStore(cfg Config, problems []progress.ProblemMeta, store Store, kv KVStore, logFn func(map[string]any)) *Server {
	if cfg.ProgressRepo == "" {
		cfg.ProgressRepo = "hot100-progress"
	}
	if cfg.TemplateRepo == "" {
		cfg.TemplateRepo = "Hanwen-Jiang/hot100-progress-template"
	}
	if cfg.GitHubAppSlug == "" {
		cfg.GitHubAppSlug = "coding-dance"
	}
	if cfg.GitHubOAuthBase == "" {
		cfg.GitHubOAuthBase = "https://github.com"
	}
	cfg.GitHubOAuthBase = strings.TrimRight(cfg.GitHubOAuthBase, "/")
	if cfg.GitHubAPIBase == "" {
		cfg.GitHubAPIBase = "https://api.github.com"
	}
	cfg.GitHubAPIBase = strings.TrimRight(cfg.GitHubAPIBase, "/")

	if len(problems) == 0 && cfg.ProblemsDir != "" {
		problems = LoadProblemsFromDir(cfg.ProblemsDir)
	}
	if store == nil {
		store = NewHotStore(problems, cfg.SnapshotFile)
	}
	if kv == nil {
		if cfg.ValkeyAddr != "" {
			kv = &ValkeyClient{Addr: cfg.ValkeyAddr, Password: cfg.ValkeyPassword}
		} else {
			kv = NewMemoryKV()
		}
	}
	metrics := otel.NewRegistry("cd-api", "bff")
	worker := NewGitSyncWorker(store, cfg.GitHubAPIBase, cfg.SessionSecret, metrics, logFn)
	hydrator := NewHydrator(store, cfg.GitHubAPIBase, cfg.ProgressRepo)
	quota := &QuotaManager{
		KV: kv,
		Cfg: QuotaConfig{
			FreeLimit:      cfg.QuotaFree,
			ProLimit:       cfg.QuotaPro,
			MinAccountDays: cfg.MinAccountDays,
			FreePaused:     cfg.FreePaused,
		},
	}
	cluster := NewClusterRouter(cfg.RunnerNodes, cfg.RunnerSecret, cfg.RunnerAccessID, cfg.RunnerAccessSecret)
	comp := NewCompanionGateway(cfg.CompanionURL, cfg.CompanionToken, cfg.WebhookURL, cfg.WebhookSecret)
	srv := &Server{
		Cfg:        cfg,
		Store:      store,
		Worker:     worker,
		Hydrator:   hydrator,
		Quota:      quota,
		Cluster:    cluster,
		Companion:  comp,
		Metrics:    metrics,
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
	}
	srv.ProfileFn = func(sess *Session) QuotaProfile {
		if sess != nil {
			if p, ok, err := store.GetProfile(context.Background(), sess.Login); err == nil && ok {
				return p.ToQuotaProfile()
			}
		}
		return QuotaProfile{Tier: "free", Founder: false}
	}
	return srv
}

func (s *Server) applyCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/")
	if origin != "" && slices.Contains(s.Cfg.SiteOrigins, origin) {
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Access-Control-Allow-Credentials", "true")
		h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		h.Set("Vary", "Origin")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	return false
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if s.applyCORS(w, r) {
		return
	}
	t0 := time.Now()
	path := r.URL.Path
	defer func() {
		s.Metrics.ObserveMs("cd_api_request_duration_ms", float64(time.Since(t0).Milliseconds()), map[string]string{"path": path, "method": r.Method})
	}()

	switch {
	case r.Method == http.MethodGet && path == "/healthz":
		writePrivateJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "cd-api"})

	case r.Method == http.MethodGet && path == "/metrics":
		s.Metrics.PrometheusHandler().ServeHTTP(w, r)

	case r.Method == http.MethodGet && path == "/v1/admin/telemetry":
		writePrivateJSON(w, http.StatusOK, s.Metrics.Snapshot())

	case r.Method == http.MethodGet && path == "/api/admin/runner":
		s.handleAdminRunner(w, r)

	case r.Method == http.MethodGet && path == "/api/session":
		s.handleSession(w, r)

	case r.Method == http.MethodGet && path == "/api/auth/login":
		s.handleAuthLogin(w, r)

	case r.Method == http.MethodGet && path == "/api/auth/install":
		s.handleAuthInstall(w, r)

	case r.Method == http.MethodGet && path == "/api/auth/callback":
		s.handleAuthCallback(w, r)

	case r.Method == http.MethodPost && path == "/api/auth/logout":
		s.handleAuthLogout(w, r)

	case path == "/api/progress":
		s.handleProgress(w, r)

	case path == "/api/progress/practice":
		s.handlePractice(w, r)

	case r.Method == http.MethodPost && path == "/api/progress/create":
		s.handleProgressCreate(w, r)

	case r.Method == http.MethodPost && path == "/api/progress/star":
		s.handleProgressStar(w, r)

	case r.Method == http.MethodGet && strings.HasPrefix(path, "/api/solutions/"):
		s.handleSolutions(w, r)

	case r.Method == http.MethodGet && path == "/api/sync/repo":
		s.handleSyncRepo(w, r)

	case r.Method == http.MethodPost && path == "/api/sync/blobs":
		s.handleSyncBlobs(w, r)

	case r.Method == http.MethodPost && path == "/api/sync/commit":
		s.handleSyncCommit(w, r)

	case r.Method == http.MethodPut && path == "/api/settings":
		s.handleSettings(w, r)

	case path == "/api/run":
		s.handleRun(w, r)

	case r.Method == http.MethodGet && path == "/api/dap":
		s.handleDAP(w, r)

	case r.Method == http.MethodGet && path == "/api/companion/status":
		writePrivateJSON(w, http.StatusOK, map[string]any{"available": s.Companion.Configured()})

	case r.Method == http.MethodPost && strings.HasPrefix(path, "/api/companion/"):
		if !CheckWriteOrigin(r, s.Cfg.SiteOrigins) {
			writePrivateJSON(w, http.StatusForbidden, map[string]any{"error": "不接受跨站请求"})
			return
		}
		ep := strings.TrimPrefix(path, "/api/companion/")
		if ep != "hint-check" && ep != "hint-reveal" && ep != "history-analyze" {
			writePrivateJSON(w, http.StatusNotFound, map[string]any{"error": "没有这个接口"})
			return
		}
		sess := s.ResolveSession(r.Context(), w, r)
		s.Companion.Forward(w, r, ep, sess, ep == "history-analyze")

	default:
		writePrivateJSON(w, http.StatusNotFound, map[string]any{"error": "没有这个接口"})
	}
}

func (s *Server) requireAuth(w http.ResponseWriter, r *http.Request, checkCSRF bool) (*Session, string, string, bool) {
	if checkCSRF && !CheckWriteOrigin(r, s.Cfg.SiteOrigins) {
		writePrivateJSON(w, http.StatusForbidden, map[string]any{"error": "不接受跨站请求"})
		return nil, "", "", false
	}
	sess := s.ResolveSession(r.Context(), w, r)
	if sess == nil {
		writePrivateJSON(w, http.StatusUnauthorized, map[string]any{"error": "还没登录"})
		return nil, "", "", false
	}
	sealedTok, err := SealData(s.Cfg.SessionSecret, sess.Token)
	if err != nil {
		writePrivateJSON(w, http.StatusInternalServerError, map[string]any{"error": "会话加密失败"})
		return nil, "", "", false
	}
	return sess, sess.Login + "/" + s.Cfg.ProgressRepo, sealedTok, true
}

func (s *Server) handleProgress(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		sess, _, _, ok := s.requireAuth(w, r, false)
		if !ok {
			return
		}
		if err := s.Hydrator.EnsureHydrated(r.Context(), sess); err != nil {
			writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
			return
		}
		ov, err := s.Store.LoadOverview(r.Context(), sess.Login)
		if err != nil {
			writePrivateJSON(w, http.StatusInternalServerError, map[string]any{"error": "读取进度失败"})
			return
		}
		writePrivateJSON(w, http.StatusOK, ov)

	case http.MethodPut:
		sess, repo, sealedTok, ok := s.requireAuth(w, r, true)
		if !ok {
			return
		}
		_ = s.Hydrator.EnsureHydrated(r.Context(), sess)
		var body struct {
			ID     int    `json:"id"`
			Status string `json:"status"`
		}
		if json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body) != nil || body.ID <= 0 || body.ID > 9999 || !slices.Contains(progress.ValidStatuses, body.Status) {
			writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "参数不对"})
			return
		}
		overview, err := s.Store.SaveStatus(r.Context(), sess.Login, repo, sealedTok, body.ID, body.Status, time.Now())
		if err != nil {
			writePrivateJSON(w, http.StatusInternalServerError, map[string]any{"error": "保存进度失败"})
			return
		}
		s.Worker.Notify()
		writePrivateJSON(w, http.StatusOK, overview)

	default:
		writePrivateJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "不支持的方法"})
	}
}

func (s *Server) handlePractice(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		sess, _, _, ok := s.requireAuth(w, r, false)
		if !ok {
			return
		}
		if err := s.Hydrator.EnsureHydrated(r.Context(), sess); err != nil {
			writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
			return
		}
		q := r.URL.Query()
		id, err := strconv.Atoi(q.Get("id"))
		mode := q.Get("mode")
		lang := q.Get("lang")
		if err != nil || id < 1 || (mode != "leetcode" && mode != "acm") {
			writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "参数不对"})
			return
		}
		code, p, found, err := s.Store.GetDraft(r.Context(), sess.Login, id, lang, mode)
		if err != nil {
			writePrivateJSON(w, http.StatusInternalServerError, map[string]any{"error": "读取草稿失败"})
			return
		}
		if !found {
			writePrivateJSON(w, http.StatusOK, map[string]any{"code": nil})
			return
		}
		writePrivateJSON(w, http.StatusOK, map[string]any{"code": code, "path": p})

	case http.MethodPost:
		sess, repo, sealedTok, ok := s.requireAuth(w, r, true)
		if !ok {
			return
		}
		_ = s.Hydrator.EnsureHydrated(r.Context(), sess)
		raw, err := io.ReadAll(io.LimitReader(r.Body, 512<<10))
		if err != nil {
			writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "读取请求失败"})
			return
		}
		save, vErr := progress.ValidatePracticeSave(raw)
		if vErr != nil {
			st := http.StatusBadRequest
			if ve, ok := vErr.(*progress.ValidationError); ok && ve.Status > 0 {
				st = ve.Status
			}
			writePrivateJSON(w, st, map[string]any{"error": vErr.Error()})
			return
		}
		res, sErr := s.Store.SavePractice(r.Context(), sess.Login, repo, sealedTok, *save, time.Now())
		if sErr != nil {
			st := http.StatusBadRequest
			if ve, ok := sErr.(*progress.ValidationError); ok && ve.Status > 0 {
				st = ve.Status
			}
			writePrivateJSON(w, st, map[string]any{"error": sErr.Error()})
			return
		}
		if res.Queued {
			s.Worker.Notify()
		}
		writePrivateJSON(w, http.StatusOK, res)

	default:
		writePrivateJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "不支持的方法"})
	}
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	sess, repo, sealedTok, ok := s.requireAuth(w, r, true)
	if !ok {
		return
	}
	_ = s.Hydrator.EnsureHydrated(r.Context(), sess)
	var body struct {
		Langs []string `json:"langs"`
	}
	if json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body) != nil {
		writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "参数不对"})
		return
	}
	cleaned := progress.CleanLangs(body.Langs)
	if len(cleaned) == 0 {
		writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "至少选一种语言"})
		return
	}
	saved, err := s.Store.SaveSettings(r.Context(), sess.Login, repo, sealedTok, cleaned, time.Now())
	if err != nil {
		writePrivateJSON(w, http.StatusInternalServerError, map[string]any{"error": "保存设置失败"})
		return
	}
	s.Worker.Notify()
	writePrivateJSON(w, http.StatusOK, map[string]any{"settings": map[string]any{"langs": saved}})
}

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	sess := s.ResolveSession(r.Context(), w, r)

	if r.Method == http.MethodGet {
		var quotaPtr *CloudQuota
		if sess != nil {
			q := s.Quota.Status(r.Context(), sess.Login, s.ProfileFn(sess), now)
			quotaPtr = &q
		}
		if !s.Cluster.Configured() {
			out := map[string]any{"available": false, "reason": "云端运行还没有部署"}
			if quotaPtr != nil {
				out["quota"] = quotaPtr
			}
			writePrivateJSON(w, http.StatusOK, out)
			return
		}
		statuses := s.Cluster.RefreshStatuses(r.Context())
		var up []*NodeStatus
		for _, st := range statuses {
			if st != nil {
				up = append(up, st)
			}
		}
		if len(up) == 0 {
			out := map[string]any{"available": false, "reason": "云端运行器暂时都不在线", "nodes": len(statuses), "up": 0}
			if quotaPtr != nil {
				out["quota"] = quotaPtr
			}
			writePrivateJSON(w, http.StatusOK, out)
			return
		}
		var langs, debugLangs, features []string
		slots, busy, queued := 0, 0, 0
		for _, st := range up {
			for _, l := range st.Langs {
				if !slices.Contains(langs, l) {
					langs = append(langs, l)
				}
			}
			for _, l := range st.DebugLangs {
				if !slices.Contains(debugLangs, l) {
					debugLangs = append(debugLangs, l)
				}
			}
			for _, f := range st.Features {
				if !slices.Contains(features, f) {
					features = append(features, f)
				}
			}
			slots += st.Slots
			busy += st.Busy
			queued += st.Queued
		}
		out := map[string]any{
			"available": true, "nodes": len(statuses), "up": len(up),
			"langs": langs, "debugLangs": debugLangs, "features": features,
			"slots": slots, "busy": busy, "queued": queued,
		}
		if quotaPtr != nil {
			out["quota"] = quotaPtr
		}
		writePrivateJSON(w, http.StatusOK, out)
		return
	}

	if r.Method != http.MethodPost {
		writePrivateJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "不支持的方法"})
		return
	}
	if !CheckWriteOrigin(r, s.Cfg.SiteOrigins) {
		writePrivateJSON(w, http.StatusForbidden, map[string]any{"error": "不接受跨站请求"})
		return
	}
	if !s.Cluster.Configured() {
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "云端运行还没有部署，暂时不能在云端运行"})
		return
	}
	if sess == nil {
		writePrivateJSON(w, http.StatusUnauthorized, map[string]any{"error": "云端运行要先登录（右上角用 GitHub 登录）"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, (1<<20)+1))
	if err != nil || len(body) > 1<<20 {
		writePrivateJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"error": "代码和用例太大了"})
		return
	}

	var hint struct {
		Lang  string `json:"lang"`
		Debug bool   `json:"debug"`
	}
	_ = json.Unmarshal(body, &hint)

	admitted, qStatus, qCode, qErr, quota := s.Quota.Consume(r.Context(), sess.Login, s.ProfileFn(sess), now)
	if !admitted {
		writePrivateJSON(w, qStatus, map[string]any{"error": qErr, "code": qCode, "quota": quota})
		return
	}

	st, rawResp, tried := s.Cluster.Run(r.Context(), sess.Login, body, hint.Lang, hint.Debug)
	if st == 0 {
		s.Quota.Refund(r.Context(), sess.Login, quota.Day)
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{
			"error": fmt.Sprintf("云端运行器都忙或者不在线（试了 %d 个节点），稍后再试", len(tried)),
		})
		return
	}
	if st >= 500 {
		s.Quota.Refund(r.Context(), sess.Login, quota.Day)
	}
	var parsed map[string]any
	if json.Unmarshal(rawResp, &parsed) != nil {
		writePrivateJSON(w, st, map[string]any{"error": fmt.Sprintf("运行器返回了看不懂的内容（%d）", st)})
		return
	}
	if st >= 200 && st < 300 {
		out := make(map[string]any, len(parsed)+1)
		maps.Copy(out, parsed)
		out["quota"] = quota
		writePrivateJSON(w, st, out)
		return
	}
	writePrivateJSON(w, st, parsed)
}

func (s *Server) handleDAP(w http.ResponseWriter, r *http.Request) {
	sess := s.ResolveSession(r.Context(), w, r)
	if sess == nil {
		writePrivateJSON(w, http.StatusUnauthorized, map[string]any{"error": "云端调试要先登录"})
		return
	}
	if !s.Cluster.Configured() {
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "云端调试尚未配置运行器节点"})
		return
	}
	admitted, qStatus, qCode, qErr, quota := s.Quota.Consume(r.Context(), sess.Login, s.ProfileFn(sess), time.Now())
	if !admitted {
		writePrivateJSON(w, qStatus, map[string]any{"error": qErr, "code": qCode, "quota": quota})
		return
	}
	s.Cluster.ProxyDAP(w, r, sess.Login, r.URL.Query().Get("lang"))
}

func writePrivateJSON(w http.ResponseWriter, status int, payload any) {
	b, _ := json.Marshal(payload)
	h := w.Header()
	h.Set("Content-Type", "application/json; charset=utf-8")
	h.Set("Cache-Control", "private, no-store")
	w.WriteHeader(status)
	_, _ = w.Write(b)
}
