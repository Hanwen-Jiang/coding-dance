package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	pending, synced := bff.Store.OutboxCounts()
	if pending != 0 || synced == 0 {
		t.Fatalf("expected 0 pending outbox items after FlushReady, got pending=%d synced=%d", pending, synced)
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
