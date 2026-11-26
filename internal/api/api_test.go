package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/progress"
	"github.com/Hanwen-Jiang/coding-dance/internal/runner"
)

type fakeGitHubRepo struct {
	mu           sync.Mutex
	headSHA      string
	treeSHA      string
	files        map[string]string // path -> content
	commits      []string
	inject409Cnt int
}

func newFakeGitHubServer(inject409 int) (*fakeGitHubRepo, *httptest.Server) {
	fg := &fakeGitHubRepo{
		headSHA:      strings.Repeat("1", 40),
		treeSHA:      strings.Repeat("2", 40),
		files:        map[string]string{"hot100.json": `{"problems":[{"id":1,"name":"两数之和"}]}`},
		inject409Cnt: inject409,
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fg.mu.Lock()
		defer fg.mu.Unlock()

		path := r.URL.Path
		switch {
		case r.Method == http.MethodGet && path == "/repos/octocat/hot100-progress":
			writePrivateJSON(w, 200, map[string]any{"default_branch": "main"})

		case r.Method == http.MethodGet && path == "/repos/octocat/hot100-progress/git/ref/heads/main":
			writePrivateJSON(w, 200, map[string]any{"object": map[string]any{"sha": fg.headSHA}})

		case r.Method == http.MethodGet && strings.HasPrefix(path, "/repos/octocat/hot100-progress/git/commits/"):
			writePrivateJSON(w, 200, map[string]any{"tree": map[string]any{"sha": fg.treeSHA}})

		case r.Method == http.MethodGet && strings.HasPrefix(path, "/repos/octocat/hot100-progress/git/trees/"):
			var tree []map[string]any
			for p, c := range fg.files {
				tree = append(tree, map[string]any{
					"path": p,
					"type": "blob",
					"sha":  progress.GitBlobSHA(c),
				})
			}
			writePrivateJSON(w, 200, map[string]any{"truncated": false, "tree": tree})

		case r.Method == http.MethodPost && path == "/repos/octocat/hot100-progress/git/trees":
			var body struct {
				Tree []struct {
					Path    string `json:"path"`
					Content string `json:"content"`
				} `json:"tree"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			for _, f := range body.Tree {
				fg.files[f.Path] = f.Content
			}
			fg.treeSHA = strings.Repeat("3", 40)
			writePrivateJSON(w, 201, map[string]any{"sha": fg.treeSHA})

		case r.Method == http.MethodPost && path == "/repos/octocat/hot100-progress/git/commits":
			var body struct {
				Message string `json:"message"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			fg.commits = append(fg.commits, body.Message)
			writePrivateJSON(w, 201, map[string]any{"sha": strings.Repeat("4", 40)})

		case r.Method == http.MethodPatch && path == "/repos/octocat/hot100-progress/git/refs/heads/main":
			if fg.inject409Cnt > 0 {
				fg.inject409Cnt--
				// Simulate concurrent external push moving HEAD!
				fg.headSHA = strings.Repeat("9", 40)
				writePrivateJSON(w, http.StatusConflict, map[string]any{"message": "Update is not a fast forward"})
				return
			}
			var body struct {
				SHA string `json:"sha"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			fg.headSHA = body.SHA
			writePrivateJSON(w, 200, map[string]any{"object": map[string]any{"sha": fg.headSHA}})

		default:
			writePrivateJSON(w, 404, map[string]any{"message": "not found: " + path})
		}
	}))
	return fg, srv
}

func TestBFFHotSaveAsyncGitCoalescingAnd409Recovery(t *testing.T) {
	fg, ghSrv := newFakeGitHubServer(1) // Inject one 409 SHA conflict to verify transparent retry!
	defer ghSrv.Close()

	// Spin up a real Go cd-runner node for /api/run end-to-end cluster verification
	runnerSecret := strings.Repeat("r", 40)
	var runnerBusyToggle atomic.Bool
	runnerNodeSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/status" {
			writePrivateJSON(w, 200, map[string]any{
				"ok": true, "node": "lou1", "slots": 4, "queue": 10, "busy": 0, "queued": 0,
				"langs": runner.Langs, "debugLangs": runner.DebugLangs, "features": runner.Features,
			})
			return
		}
		if r.URL.Path == "/v1/run" {
			if runnerBusyToggle.Load() {
				writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "busy"})
				return
			}
			writePrivateJSON(w, 200, map[string]any{
				"ok": true, "node": "lou1", "compileMs": 2, "runMs": 1,
				"results": []map[string]any{{"index": 0, "stdout": "3\n", "duration": 1}},
			})
			return
		}
		w.WriteHeader(404)
	}))
	defer runnerNodeSrv.Close()

	companionUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writePrivateJSON(w, 200, map[string]any{
			"ok":     true,
			"user":   r.Header.Get("X-Coding-Dance-User"),
			"tenant": r.Header.Get("X-Coding-Dance-Tenant"),
		})
	}))
	defer companionUpstream.Close()

	sessionSecret := "super-secret-session-key-0123456789"
	cfg := Config{
		SessionSecret:  sessionSecret,
		SiteOrigins:    []string{"https://leetcode.cgent.link", "https://codexdance.cn", "https://codingdance.cn"},
		ProgressRepo:   "hot100-progress",
		GitHubAPIBase:  ghSrv.URL,
		RunnerNodes:    []RunnerNode{{ID: "lou1", URL: runnerNodeSrv.URL}},
		RunnerSecret:   runnerSecret,
		QuotaFree:      2,
		QuotaPro:       2000,
		MinAccountDays: 0,
		CompanionURL:   companionUpstream.URL,
		CompanionToken: "companion-secret",
	}
	problems := []progress.ProblemMeta{{ID: 1, Name: "两数之和"}}
	bff := NewServer(cfg, problems, NewMemoryKV(), func(map[string]any) {})
	apiSrv := httptest.NewServer(bff)
	defer apiSrv.Close()

	cookieVal, err := SealData(sessionSecret, Session{
		Token:  "ghu_testtoken",
		Login:  "octocat",
		Avatar: "https://avatars.example/u/1",
		ExpMs:  time.Now().Add(24 * time.Hour).UnixMilli(),
	})
	if err != nil {
		t.Fatal(err)
	}

	callAPI := func(method, path, origin, body string) (*http.Response, map[string]any) {
		var r *bytes.Reader
		if body != "" {
			r = bytes.NewReader([]byte(body))
		} else {
			r = bytes.NewReader(nil)
		}
		req, err := http.NewRequest(method, apiSrv.URL+path, r)
		if err != nil {
			t.Fatal(err)
		}
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: cookieVal})
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp, out
	}

	// 1) Multi-domain CORS works across all 3 origins without redirect SSO!
	for _, origin := range cfg.SiteOrigins {
		resp, _ := callAPI("GET", "/api/progress", origin, "")
		if resp.StatusCode != 200 || resp.Header.Get("Access-Control-Allow-Origin") != origin {
			t.Fatalf("CORS failed for %s: status=%d allow=%q", origin, resp.StatusCode, resp.Header.Get("Access-Control-Allow-Origin"))
		}
	}

	// 2) Fire 5 rapid draft saves + 1 full AC run -> all return 200 immediately (<5ms)
	for i := 1; i <= 5; i++ {
		draftBody := `{"kind":"draft","id":1,"lang":"go","mode":"leetcode","code":"// v` + string(rune('0'+i)) + `\nfunc twoSum() {}"}`
		resp, js := callAPI("POST", "/api/progress/practice", "https://codingdance.cn", draftBody)
		if resp.StatusCode != 200 || js["saved"] != true {
			t.Fatalf("draft %d failed: %d %#v", i, resp.StatusCode, js)
		}
	}
	// Read back latest draft immediately from HotStore before Git sync even runs!
	dResp, dJSON := callAPI("GET", "/api/progress/practice?id=1&lang=go&mode=leetcode", "https://codingdance.cn", "")
	if dResp.StatusCode != 200 || !strings.Contains(dJSON["code"].(string), "// v5") {
		t.Fatalf("expected latest draft // v5 from HotStore, got %#v", dJSON)
	}

	runSaveBody := `{"kind":"run","id":1,"lang":"go","mode":"leetcode","code":"func twoSum(nums []int, target int) []int { return []int{0, 1} }","result":"通过","passed":15,"total":15,"duration":8}`
	rResp, rJSON := callAPI("POST", "/api/progress/practice", "https://leetcode.cgent.link", runSaveBody)
	if rResp.StatusCode != 200 || rJSON["status"] != "已通过" {
		t.Fatalf("run save failed: %d %#v", rResp.StatusCode, rJSON)
	}

	// Flush async Git worker once -> coalesces all 5 drafts + attempt + solution + progress.json AND transparently recovers from injected 409!
	bff.Worker.FlushReady(t.Context())
	pending, synced, err := bff.Store.OutboxCounts(t.Context())
	if err != nil || pending != 0 || synced == 0 {
		t.Fatalf("expected 0 pending outbox items after FlushReady, got pending=%d synced=%d err=%v", pending, synced, err)
	}

	fg.mu.Lock()
	draftGit := fg.files["drafts/go/0001.两数之和.go"]
	solGit := fg.files["solutions/go/0001.两数之和.go"]
	progGit := fg.files["progress.json"]
	fg.mu.Unlock()
	if !strings.Contains(draftGit, "// v5") || solGit == "" || !strings.Contains(progGit, "已通过") {
		t.Fatalf("unexpected git synced files:\ndraft=%q\nsol=%q\nprog=%q", draftGit, solGit, progGit)
	}

	// 3) Daily Cloud Quota & automatic refund when runner cluster is busy (503)
	runReqBody := `{"lang":"go","mode":"acm","code":"package main","cases":[{"stdin":"1 2"}]}`
	runnerBusyToggle.Store(true)
	busyRunResp, _ := callAPI("POST", "/api/run", "https://codexdance.cn", runReqBody)
	if busyRunResp.StatusCode != 503 {
		t.Fatalf("expected 503 when runner busy, got %d", busyRunResp.StatusCode)
	}
	// Quota must have been refunded (still 0 used out of 2)!
	stRunResp, stRunJSON := callAPI("GET", "/api/run", "https://codexdance.cn", "")
	if stRunResp.StatusCode != 200 || stRunJSON["quota"].(map[string]any)["used"].(float64) != 0 {
		t.Fatalf("expected quota refunded to 0 used, got %#v", stRunJSON)
	}

	runnerBusyToggle.Store(false)
	for range 2 {
		okResp, _ := callAPI("POST", "/api/run", "https://codexdance.cn", runReqBody)
		if okResp.StatusCode != 200 {
			t.Fatalf("expected 200 on /api/run, got %d", okResp.StatusCode)
		}
	}
	overResp, overJSON := callAPI("POST", "/api/run", "https://codexdance.cn", runReqBody)
	if overResp.StatusCode != 429 || overJSON["code"] != "quota_exceeded" {
		t.Fatalf("expected 429 quota_exceeded on 3rd run, got %d %#v", overResp.StatusCode, overJSON)
	}

	// 4) Consent-First Companion enforcement
	deniedComp, _ := callAPI("POST", "/api/companion/hint-reveal", "https://leetcode.cgent.link", `{"consent_mode":"off","user_consented":true}`)
	if deniedComp.StatusCode != 403 {
		t.Fatalf("expected 403 when consent_mode=off, got %d", deniedComp.StatusCode)
	}
	okComp, okCompJSON := callAPI("POST", "/api/companion/hint-reveal", "https://leetcode.cgent.link", `{"consent_mode":"ask","user_consented":true}`)
	if okComp.StatusCode != 200 || okCompJSON["user"] != "gh-octocat" || okCompJSON["tenant"] != "gh-octocat" {
		t.Fatalf("companion forward mismatch: %d %#v", okComp.StatusCode, okCompJSON)
	}
}

func TestOAuthLoginHydrationSolutionsSyncAndAdminRunner(t *testing.T) {
	fg, ghSrv := newFakeGitHubServer(0)
	defer ghSrv.Close()

	// Seed pre-existing user progress repository files before login (cold-start hydration test).
	fg.mu.Lock()
	fg.files["progress.json"] = `{"version":1,"problems":{"1":{"status":"曾通过","updatedAt":"2026-11-10"}}}`
	fg.files["settings.json"] = `{"version":1,"langs":["java","go"]}`
	fg.files["drafts/java/0001.两数之和.java"] = "class Solution { /* saved draft */ }\n"
	fg.files["solutions/java/0001.两数之和.java"] = "// @lc code=start\nclass Solution { int[] twoSum(int[] a, int t) { return null; } }\n// @lc code=end\n"
	fg.files["attempts/0001.两数之和/2026-11-10.1.答案错误.md"] = "---\nlang: java\nverbatim: true\nsource: practice\nmode: leetcode\nranAt: 2026-11-10T12:00:00+08:00\n---\n\n## 代码\n\n```java\nclass Solution {}\n```\n\n## 测试结果\n\n答案错误\n"
	fg.mu.Unlock()

	var starred []string
	var oauthMu sync.Mutex
	var fakeAllMux http.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		switch {
		case r.Method == http.MethodPost && p == "/login/oauth/access_token":
			writePrivateJSON(w, 200, map[string]any{
				"access_token":  "ghu_oauth_token",
				"refresh_token": "ghr_refresh_token",
				"expires_in":    28800,
			})
		case r.Method == http.MethodGet && p == "/user":
			writePrivateJSON(w, 200, map[string]any{
				"login":      "octocat",
				"avatar_url": "https://avatars.example/octo.png",
				"created_at": "2020-01-01T00:00:00Z",
			})
		case r.Method == http.MethodGet && p == "/user/installations":
			writePrivateJSON(w, 200, map[string]any{
				"installations": []map[string]any{{
					"id":                   42,
					"account":              map[string]any{"login": "octocat"},
					"repository_selection": "all",
					"permissions":          map[string]any{"repository_creation": "write"},
					"created_at":           "2026-11-01T00:00:00Z", // before 2026-11-18 cutoff -> founder!
				}},
			})
		case r.Method == http.MethodGet && strings.HasPrefix(p, "/user/starred/"):
			w.WriteHeader(204)
		case r.Method == http.MethodPut && strings.HasPrefix(p, "/user/starred/"):
			oauthMu.Lock()
			starred = append(starred, strings.TrimPrefix(p, "/user/starred/"))
			oauthMu.Unlock()
			w.WriteHeader(204)
		case r.Method == http.MethodGet && strings.HasPrefix(p, "/repos/octocat/hot100-progress/git/blobs/"):
			sha := strings.TrimPrefix(p, "/repos/octocat/hot100-progress/git/blobs/")
			fg.mu.Lock()
			var matched string
			for _, content := range fg.files {
				if progress.GitBlobSHA(content) == sha {
					matched = content
					break
				}
			}
			fg.mu.Unlock()
			if matched == "" {
				writePrivateJSON(w, 404, map[string]any{"message": "blob not found"})
				return
			}
			writePrivateJSON(w, 200, map[string]any{"encoding": "utf-8", "content": matched})
		default:
			ghSrv.Config.Handler.ServeHTTP(w, r)
		}
	})
	fullGH := httptest.NewServer(fakeAllMux)
	defer fullGH.Close()

	runnerSecret := strings.Repeat("a", 40)
	runnerNodeSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/status":
			writePrivateJSON(w, 200, map[string]any{"ok": true, "node": "lou1", "slots": 4, "queue": 8, "busy": 1, "queued": 0, "dapActive": 1})
		case "/v1/admin/telemetry":
			writePrivateJSON(w, 200, map[string]any{"service": "cd-runner", "node": "lou1"})
		default:
			w.WriteHeader(404)
		}
	}))
	defer runnerNodeSrv.Close()

	cfg := Config{
		SessionSecret:      "oauth-test-session-secret-0123456789",
		SiteOrigins:        []string{"https://codingdance.cn"},
		GitHubClientID:     "iv1.testclient",
		GitHubClientSecret: "client-secret",
		GitHubAppSlug:      "coding-dance",
		GitHubOAuthBase:    fullGH.URL,
		GitHubAPIBase:      fullGH.URL,
		ProgressRepo:       "hot100-progress",
		TemplateRepo:       "Hanwen-Jiang/hot100-progress-template",
		FounderCutoff:      "2026-11-18T00:00:00+08:00",
		RunnerNodes:        []RunnerNode{{ID: "lou1", URL: runnerNodeSrv.URL}},
		RunnerSecret:       runnerSecret,
		AdminToken:         "admin-secret-token",
	}
	bff := NewServer(cfg, []progress.ProblemMeta{{ID: 1, Name: "两数之和"}}, NewMemoryKV(), nil)
	apiSrv := httptest.NewServer(bff)
	defer apiSrv.Close()

	noRedirect := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

	// 1) /api/auth/login sets hot100_oauth cookie and redirects to GitHub OAuth authorize
	loginResp, err := noRedirect.Get(apiSrv.URL + "/api/auth/login?return=%2Fp%2F1%2F")
	if err != nil || loginResp.StatusCode != http.StatusFound {
		t.Fatalf("login failed: status=%v err=%v", loginResp, err)
	}
	loc := loginResp.Header.Get("Location")
	if !strings.Contains(loc, "/login/oauth/authorize") || !strings.Contains(loc, "client_id=iv1.testclient") {
		t.Fatalf("unexpected authorize location: %s", loc)
	}
	uLoc, _ := strings.CutPrefix(loc, fullGH.URL)
	_ = uLoc
	parsedLoc, _ := http.NewRequest("GET", loc, nil)
	state := parsedLoc.URL.Query().Get("state")
	var cookies []*http.Cookie
	cookies = append(cookies, loginResp.Cookies()...)
	_ = loginResp.Body.Close()

	// 2) /api/auth/callback exchanges code, sets hot100_session, redirects back to /p/1/
	cbReq, _ := http.NewRequest("GET", apiSrv.URL+"/api/auth/callback?code=ghcode_123&state="+state, nil)
	for _, c := range cookies {
		cbReq.AddCookie(c)
	}
	cbResp, err := noRedirect.Do(cbReq)
	if err != nil || cbResp.StatusCode != http.StatusFound || cbResp.Header.Get("Location") != "/p/1/" {
		t.Fatalf("callback failed: status=%d loc=%q err=%v", cbResp.StatusCode, cbResp.Header.Get("Location"), err)
	}
	var sessionCookie *http.Cookie
	for _, c := range cbResp.Cookies() {
		if c.Name == SessionCookieName && c.Value != "" {
			sessionCookie = c
		}
	}
	_ = cbResp.Body.Close()
	if sessionCookie == nil {
		t.Fatalf("expected hot100_session cookie from callback")
	}

	// 3) /api/session returns user + founder member + accessible repo + starred
	sessReq, _ := http.NewRequest("GET", apiSrv.URL+"/api/session", nil)
	sessReq.AddCookie(sessionCookie)
	sessResp, err := http.DefaultClient.Do(sessReq)
	if err != nil || sessResp.StatusCode != 200 {
		t.Fatalf("/api/session failed: %v", err)
	}
	var sessJSON map[string]any
	_ = json.NewDecoder(sessResp.Body).Decode(&sessJSON)
	_ = sessResp.Body.Close()
	if sessJSON["member"].(map[string]any)["founder"] != true {
		t.Fatalf("expected founder=true from cutoff check, got %#v", sessJSON)
	}
	if sessJSON["repo"].(map[string]any)["accessible"] != true {
		t.Fatalf("expected repo.accessible=true, got %#v", sessJSON)
	}

	// 4) /api/progress triggers cold-start hydration & returns status/langs/settings
	progReq, _ := http.NewRequest("GET", apiSrv.URL+"/api/progress", nil)
	progReq.AddCookie(sessionCookie)
	progResp, err := http.DefaultClient.Do(progReq)
	if err != nil || progResp.StatusCode != 200 {
		t.Fatalf("/api/progress failed: %v", err)
	}
	var progJSON ProgressOverview
	_ = json.NewDecoder(progResp.Body).Decode(&progJSON)
	_ = progResp.Body.Close()
	if progJSON.Status["1"] != "曾通过" {
		t.Fatalf("expected hydrated status 曾通过, got %#v", progJSON)
	}

	// 5) /api/solutions/1 returns hydrated solutions + attempts in exact frontend schema
	solReq, _ := http.NewRequest("GET", apiSrv.URL+"/api/solutions/1", nil)
	solReq.AddCookie(sessionCookie)
	solResp, err := http.DefaultClient.Do(solReq)
	if err != nil || solResp.StatusCode != 200 {
		t.Fatalf("/api/solutions/1 failed: %v", err)
	}
	var solJSON ProblemHistoryResponse
	_ = json.NewDecoder(solResp.Body).Decode(&solJSON)
	_ = solResp.Body.Close()
	if len(solJSON.History) != 1 || len(solJSON.Attempts) != 1 || solJSON.Attempts[0].Result != "答案错误" {
		t.Fatalf("unexpected /api/solutions/1 response: %#v", solJSON)
	}

	// 6) /api/admin/runner auth + cluster telemetry + outbox counts
	unauthAdm, _ := http.Get(apiSrv.URL + "/api/admin/runner")
	if unauthAdm.StatusCode != 401 {
		t.Fatalf("expected 401 for unauthenticated /api/admin/runner, got %d", unauthAdm.StatusCode)
	}
	_ = unauthAdm.Body.Close()

	admReq, _ := http.NewRequest("GET", apiSrv.URL+"/api/admin/runner", nil)
	admReq.Header.Set("Authorization", "Bearer admin-secret-token")
	admResp, err := http.DefaultClient.Do(admReq)
	if err != nil || admResp.StatusCode != 200 {
		t.Fatalf("/api/admin/runner failed: %v", err)
	}
	var admJSON map[string]any
	_ = json.NewDecoder(admResp.Body).Decode(&admJSON)
	_ = admResp.Body.Close()
	if admJSON["summary"].(map[string]any)["onlineNodes"].(float64) != 1 {
		t.Fatalf("unexpected /api/admin/runner payload: %#v", admJSON)
	}

	// 7) /api/progress/star + /api/auth/logout
	starReq, _ := http.NewRequest("POST", apiSrv.URL+"/api/progress/star", strings.NewReader(`{"repos":["Hanwen-Jiang/hot100-progress-template"]}`))
	starReq.Header.Set("Origin", "https://codingdance.cn")
	starReq.Header.Set("Content-Type", "application/json")
	starReq.AddCookie(sessionCookie)
	starResp, err := http.DefaultClient.Do(starReq)
	if err != nil || starResp.StatusCode != 200 {
		t.Fatalf("/api/progress/star failed: %v", err)
	}
	_ = starResp.Body.Close()

	outReq, _ := http.NewRequest("POST", apiSrv.URL+"/api/auth/logout", nil)
	outReq.Header.Set("Origin", "https://codingdance.cn")
	outReq.AddCookie(sessionCookie)
	outResp, err := http.DefaultClient.Do(outReq)
	if err != nil || outResp.StatusCode != 200 {
		t.Fatalf("/api/auth/logout failed: %v", err)
	}
	_ = outResp.Body.Close()
}

func TestPostgresStoreEndToEnd(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping real PostgreSQL integration test")
	}
	problems := []progress.ProblemMeta{{ID: 1, Name: "两数之和"}}
	store, err := NewPostgresStore(t.Context(), dsn, problems)
	if err != nil {
		t.Fatalf("NewPostgresStore failed: %v", err)
	}
	defer store.Close()

	login := "pgtest_" + strings.ToLower(t.Name())
	login = strings.ReplaceAll(login, "/", "_")
	if len(login) > 32 {
		login = login[:32]
	}

	fg, ghSrv := newFakeGitHubServer(1)
	defer ghSrv.Close()

	cfg := Config{
		SessionSecret: "pg-test-session-secret-0123456789",
		SiteOrigins:   []string{"https://codingdance.cn"},
		ProgressRepo:  "hot100-progress",
		GitHubAPIBase: ghSrv.URL,
	}
	bff := NewServerWithStore(cfg, problems, store, NewMemoryKV(), nil)
	now := time.Now()
	_ = store.UpsertProfile(t.Context(), UserProfile{Login: login, AvatarURL: "a.png", Tier: "pro", Founder: true})
	_ = store.ReplaceFromHydration(t.Context(), login, HydratedRepo{}, now)

	sealedTok, _ := SealData(cfg.SessionSecret, "ghu_pgtoken")
	repo := "octocat/hot100-progress"
	if _, err := store.SavePractice(t.Context(), login, repo, sealedTok, progress.PracticeSave{
		Kind: "draft", ID: 1, Lang: "go", Mode: "leetcode", Code: "func twoSum() {}",
	}, now); err != nil {
		t.Fatalf("pg draft save failed: %v", err)
	}
	code, _, ok, err := store.GetDraft(t.Context(), login, 1, "go", "leetcode")
	if err != nil || !ok || !strings.Contains(code, "twoSum") {
		t.Fatalf("pg GetDraft mismatch: ok=%v code=%q err=%v", ok, code, err)
	}
	res, err := store.SavePractice(t.Context(), login, repo, sealedTok, progress.PracticeSave{
		Kind: "run", ID: 1, Lang: "go", Mode: "leetcode", Code: "func twoSum() []int { return nil }",
		Result: "通过", Passed: 10, Total: 10, Duration: 5, Scope: "full",
	}, now)
	if err != nil || !res.Saved || res.Status != "已通过" {
		t.Fatalf("pg run save failed: %#v err=%v", res, err)
	}
	hist, err := store.LoadProblemHistory(t.Context(), login, 1)
	if err != nil || len(hist.History) != 1 || len(hist.Attempts) != 1 {
		t.Fatalf("pg LoadProblemHistory failed: %#v err=%v", hist, err)
	}
	bff.Worker.FlushReady(t.Context())
	pending, synced, err := store.OutboxCounts(t.Context())
	if err != nil || pending != 0 || synced == 0 {
		t.Fatalf("pg outbox not flushed: pending=%d synced=%d err=%v", pending, synced, err)
	}
	fg.mu.Lock()
	sol := fg.files["solutions/go/0001.两数之和.go"]
	fg.mu.Unlock()
	if sol == "" {
		t.Fatalf("expected solution written to git repo by pg worker")
	}
}
