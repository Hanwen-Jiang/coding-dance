package runner

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/ws"
)

func TestSignFixedVectorAndVerify(t *testing.T) {
	// Must match site/functions/_lib/test/runner.test.ts exact vector.
	secret := strings.Repeat("k", 32)
	got := Sign(secret, SignParts{
		Method:   "post",
		Path:     "/v1/run",
		Time:     1700000000,
		Nonce:    "abcdefabcdefabcdef",
		User:     "octocat",
		Node:     "lou1",
		BodyHash: SHA256Hex([]byte(`{"a":1}`)),
	})
	const want = "b2b038630a930c64fc00723773ca316ad21faf9e8abc4e138d3e6e3c54b27b2b"
	if got != want {
		t.Fatalf("fixed signature mismatch:\n got: %s\nwant: %s", got, want)
	}

	testSecret := "test-secret-0123456789abcdef0123456789"
	now := time.Now()
	body := []byte(`{"x":1}`)
	hdrMap := SignedHeaders(testSecret, "POST", "/v1/run", "lou1", "alice", body, now)
	hdr := make(http.Header)
	for k, v := range hdrMap {
		hdr.Set(k, v)
	}
	nonces := NewNonceCache(0)
	res := Verify(testSecret, VerifyInput{Method: "POST", Path: "/v1/run", Headers: hdr, Body: body, Node: "lou1", Now: now, Nonces: nonces})
	if !res.OK || res.User != "alice" {
		t.Fatalf("expected valid signature, got %+v", res)
	}
	replay := Verify(testSecret, VerifyInput{Method: "POST", Path: "/v1/run", Headers: hdr, Body: body, Node: "lou1", Now: now, Nonces: nonces})
	if replay.OK || replay.Reason != "这个请求已经用过了" {
		t.Fatalf("expected replay rejection, got %+v", replay)
	}
	wrongNode := Verify(testSecret, VerifyInput{Method: "POST", Path: "/v1/run", Headers: hdr, Body: body, Node: "lou2", Now: now})
	if wrongNode.OK || !strings.Contains(wrongNode.Reason, "发给节点 lou1") {
		t.Fatalf("expected wrong node rejection, got %+v", wrongNode)
	}
	expired := Verify(testSecret, VerifyInput{Method: "POST", Path: "/v1/run", Headers: hdr, Body: body, Node: "lou1", Now: now.Add(10 * time.Minute)})
	if expired.OK || !strings.Contains(expired.Reason, "签名过期") {
		t.Fatalf("expected skew rejection, got %+v", expired)
	}
}

func TestValidateJobParity(t *testing.T) {
	cases := []struct {
		raw  string
		want string
	}{
		{`{"lang":"cobol","mode":"acm","code":"x","cases":[{"stdin":""}]}`, "不支持的语言"},
		{`{"lang":"rust","mode":"acm","code":"x","cases":[{"stdin":""}]}`, ""},
		{`{"lang":"python","mode":"acm","code":"x","cases":[{"stdin":""}],"debug":true}`, "这门语言不能在云端调试"},
		{`{"lang":"kotlin","mode":"acm","code":"x","cases":[{"stdin":""}],"debug":true}`, "这门语言不能在云端调试"},
		{`{"lang":"java","mode":"leetcode","code":"x","cases":[{"input":[]},{"input":[]}],"debug":true}`, "调试一次只跑一组用例"},
		{`{"lang":"java","mode":"leetcode","code":"x","cases":[{"input":[]}]}`, "力扣模式要有函数签名"},
		{`{"lang":"go","mode":"acm","code":"x","cases":[{"stdin":"1"}]}`, ""},
	}
	for _, tc := range cases {
		_, msg, _ := ParseAndValidateJob([]byte(tc.raw))
		if msg != tc.want {
			t.Errorf("validate(%s) = %q, want %q", tc.raw, msg, tc.want)
		}
	}
}

type fakeFCServer struct {
	srv    *httptest.Server
	token  string
	maxVMs int
	mu     sync.Mutex
	envs   map[string]struct{}
	logs   []string
}

func startFakeFC(token string, maxVMs int) *fakeFCServer {
	f := &fakeFCServer{
		token:  token,
		maxVMs: maxVMs,
		envs:   make(map[string]struct{}),
	}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true}, nil)
			return
		}
		if r.Header.Get("Authorization") != "Bearer "+f.token {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"code": "unauthenticated", "message": "令牌不对"}, nil)
			return
		}
		f.mu.Lock()
		f.logs = append(f.logs, r.Method+" "+r.URL.Path)
		f.mu.Unlock()

		if r.Method == http.MethodPost && r.URL.Path == "/v1/envs" {
			f.mu.Lock()
			if len(f.envs) >= f.maxVMs {
				f.mu.Unlock()
				writeJSON(w, http.StatusServiceUnavailable, map[string]any{"code": "host_capacity", "message": "宿主容量满了"}, nil)
				return
			}
			id := "env-" + randomHex(4)
			f.envs[id] = struct{}{}
			f.mu.Unlock()
			writeJSON(w, http.StatusCreated, map[string]any{"env_id": id, "runtime": "lc-runner"}, nil)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 3 && parts[0] == "v1" && parts[1] == "envs" {
			id := parts[2]
			f.mu.Lock()
			_, exists := f.envs[id]
			f.mu.Unlock()
			if !exists {
				writeJSON(w, http.StatusNotFound, map[string]any{"code": "not_found"}, nil)
				return
			}
			if r.Method == http.MethodDelete && len(parts) == 3 {
				f.mu.Lock()
				delete(f.envs, id)
				f.mu.Unlock()
				w.WriteHeader(http.StatusNoContent)
				return
			}
			if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/agent/v1/exec") {
				var req struct {
					Argv      []string `json:"argv"`
					Stdin     string   `json:"stdin"`
					TimeoutMs int64    `json:"timeout_ms"`
				}
				_ = json.NewDecoder(r.Body).Decode(&req)
				stdinRaw, _ := base64.StdEncoding.DecodeString(req.Stdin)

				// Support FirecrackerDriver DAP daemon + poll protocol in fake fc-manager!
				if len(req.Argv) >= 3 && req.Argv[2] == "daemon" {
					out := `{"ok":true,"lang":"go","mode":"acm","userFile":"main.go","lines":4}`
					writeJSON(w, http.StatusOK, map[string]any{
						"exit_code": 0, "timed_out": false,
						"stdout": base64.StdEncoding.EncodeToString([]byte(out)), "stderr": "",
					}, nil)
					return
				}
				if len(req.Argv) >= 3 && req.Argv[2] == "poll" {
					var pollIn struct {
						Frames []string `json:"frames"`
					}
					_ = json.Unmarshal(stdinRaw, &pollIn)
					var outFrames []string
					exited := false
					for _, fr := range pollIn.Frames {
						var m map[string]any
						_ = json.Unmarshal([]byte(fr), &m)
						cmd, _ := m["command"].(string)
						b, _ := json.Marshal(map[string]any{
							"seq": 1, "type": "response", "request_seq": m["seq"],
							"success": true, "command": cmd,
						})
						outFrames = append(outFrames, string(b))
						if cmd == "disconnect" {
							exited = true
						}
					}
					if len(outFrames) == 0 {
						time.Sleep(30 * time.Millisecond)
					}
					pollOut, _ := json.Marshal(map[string]any{"ok": true, "frames": outFrames, "exited": exited})
					writeJSON(w, http.StatusOK, map[string]any{
						"exit_code": 0, "timed_out": false,
						"stdout": base64.StdEncoding.EncodeToString(pollOut), "stderr": "",
					}, nil)
					return
				}

				if strings.Contains(string(stdinRaw), "SLEEP_SLOW") {
					time.Sleep(250 * time.Millisecond)
				}
				if strings.Contains(string(stdinRaw), "INFINITE_LOOP") {
					writeJSON(w, http.StatusOK, map[string]any{"exit_code": nil, "timed_out": true, "stdout": "", "stderr": ""}, nil)
					return
				}
				outJSON := `{"ok":true,"compileMs":5,"runMs":3,"results":[{"index":0,"actual":null,"stdout":"42\n","duration":3}]}`
				writeJSON(w, http.StatusOK, map[string]any{
					"exit_code": 0,
					"timed_out": false,
					"stdout":    base64.StdEncoding.EncodeToString([]byte(outJSON)),
					"stderr":    "",
				}, nil)
				return
			}
		}
		writeJSON(w, http.StatusNotFound, map[string]any{"code": "not_found"}, nil)
	}))
	return f
}

func TestServerFirecrackerSecretStoreOTelAndDAPMicroVMLifecycle(t *testing.T) {
	fcToken := strings.Repeat("t", 40)
	fake := startFakeFC(fcToken, 1)
	defer fake.srv.Close()

	tmpDir := t.TempDir()
	secretFile := filepath.Join(tmpDir, "fc-secrets.json")
	secretJSON := fmt.Sprintf(`{"version":1,"scopes":{"_platform":{"secrets":{"sandbox/fc-manager-token":%q},"roles":[]}}}`, fcToken)
	if err := os.WriteFile(secretFile, []byte(secretJSON), 0o600); err != nil {
		t.Fatal(err)
	}

	drv := NewFirecrackerDriver(FirecrackerConfig{
		URL:       fake.srv.URL,
		TokenFile: secretFile,
	})
	if err := drv.Init(context.Background()); err != nil {
		t.Fatalf("driver init: %v", err)
	}

	secret := strings.Repeat("s", 40)
	var logMu sync.Mutex
	var logs []map[string]any
	srv := NewServer(Config{
		Node:         "lou1",
		Secret:       secret,
		PerMinute:    3,
		Slots:        2,
		Queue:        2,
		CaseMs:       3000,
		TotalMs:      20000,
		JobMs:        60000,
		DAPIdleMs:    5000,
		DAPMaxMs:     30000,
		DAPMaxActive: 4,
		Version:      "test-go",
	}, drv, func(entry map[string]any) {
		logMu.Lock()
		logs = append(logs, entry)
		logMu.Unlock()
	})

	ts := httptest.NewServer(srv)
	defer ts.Close()

	doSigned := func(method, path, user, body string) (*http.Response, map[string]any) {
		req, err := http.NewRequest(method, ts.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		if method == http.MethodGet {
			req.Body = nil
		}
		for k, v := range SignedHeaders(secret, method, path, "lou1", user, []byte(body), time.Now()) {
			req.Header.Set(k, v)
		}
		if method == http.MethodPost {
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

	// 1) Unauthenticated /healthz
	hResp, err := http.Get(ts.URL + "/healthz")
	if err != nil || hResp.StatusCode != 200 {
		t.Fatalf("healthz failed: %v", err)
	}
	_ = hResp.Body.Close()

	// 2) Signed /v1/status
	stResp, stJSON := doSigned("GET", "/v1/status", "", "")
	if stResp.StatusCode != 200 || stJSON["node"] != "lou1" {
		t.Fatalf("status failed: %d %#v", stResp.StatusCode, stJSON)
	}

	// 3) Run via FirecrackerDriver + verify VM cleanup and bootMs diagnostics
	jobBody := `{"lang":"python","mode":"acm","code":"print(42)","cases":[{"stdin":"20 22"}]}`
	runResp, runJSON := doSigned("POST", "/v1/run", "alice", jobBody)
	if runResp.StatusCode != 200 || runJSON["node"] != "lou1" {
		t.Fatalf("run failed: %d %#v", runResp.StatusCode, runJSON)
	}
	if bootVal, ok := runJSON["bootMs"].(float64); !ok || bootVal < 0 {
		t.Fatalf("expected bootMs >= 0 in /v1/run response, got %#v", runJSON)
	}
	logMu.Lock()
	var runLog map[string]any
	for _, entry := range logs {
		if entry["event"] == "run" && entry["user"] == "alice" {
			runLog = entry
			break
		}
	}
	logMu.Unlock()
	if runLog == nil {
		t.Fatalf("expected structured run log entry for alice")
	}
	for _, k := range []string{"bootMs", "compileMs", "runMs", "queueMs", "totalMs"} {
		if _, ok := runLog[k]; !ok {
			t.Fatalf("expected %q in run log entry, got %#v", k, runLog)
		}
	}
	waitZeroEnvs(t, fake)

	// 4) Interactive WebSocket DAP via FirecrackerDriver (microVM daemon + poll + DELETE cleanup!)
	hdrs := SignedHeaders(secret, "GET", "/v1/dap", "lou1", "fc-debugger", nil, time.Now())
	q := url.Values{}
	q.Set("time", hdrs["x-runner-time"])
	q.Set("nonce", hdrs["x-runner-nonce"])
	q.Set("user", hdrs["x-runner-user"])
	q.Set("node", hdrs["x-runner-node"])
	q.Set("sig", hdrs["x-runner-signature"])
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/v1/dap?" + q.Encode()
	dapConn, err := ws.Dial(context.Background(), wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial /v1/dap failed: %v", err)
	}
	_ = dapConn.WriteJSON(DAPInitRequest{Type: "init", Lang: "go", Mode: "acm", Code: "package main\nfunc main() {}\n"})
	_, readyRaw, err := dapConn.ReadMessage()
	if err != nil || !bytes.Contains(readyRaw, []byte(`"ready"`)) {
		t.Fatalf("expected ready over Firecracker DAP, got %q err=%v", string(readyRaw), err)
	}
	_ = dapConn.WriteJSON(map[string]any{"seq": 1, "type": "request", "command": "initialize"})
	_, initReply, err := dapConn.ReadMessage()
	if err != nil || !bytes.Contains(initReply, []byte(`"initialize"`)) {
		t.Fatalf("expected initialize response from microVM DAP, got %q err=%v", string(initReply), err)
	}
	_ = dapConn.WriteJSON(map[string]any{"seq": 2, "type": "request", "command": "disconnect"})
	_ = dapConn.Close()
	waitZeroEnvs(t, fake)

	// 5) Per-user rate limit (PerMinute=3)
	for range 3 {
		r, _ := doSigned("POST", "/v1/run", "bob", jobBody)
		if r.StatusCode != 200 {
			t.Fatalf("expected 200 for bob, got %d", r.StatusCode)
		}
	}
	rlResp, _ := doSigned("POST", "/v1/run", "bob", jobBody)
	if rlResp.StatusCode != 429 {
		t.Fatalf("expected 429 on 4th call within a minute, got %d", rlResp.StatusCode)
	}

	// 6) VM capacity 503 -> Retry-After: 5
	waitZeroEnvs(t, fake)
	slowJob := `{"lang":"python","mode":"acm","code":"SLEEP_SLOW","cases":[{"stdin":""}]}`
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		r, _ := doSigned("POST", "/v1/run", "u1", slowJob)
		if r.StatusCode != 200 {
			t.Errorf("first slow job expected 200, got %d", r.StatusCode)
		}
	}()
	time.Sleep(50 * time.Millisecond)
	busyResp, _ := doSigned("POST", "/v1/run", "u2", jobBody)
	if busyResp.StatusCode != 503 || busyResp.Header.Get("Retry-After") != "5" {
		t.Fatalf("expected 503 with Retry-After=5 when microVMs full, got %d", busyResp.StatusCode)
	}
	wg.Wait()

	// 7) #/admin telemetry snapshot & Prometheus exposition
	telResp, telJSON := doSigned("GET", "/v1/admin/telemetry", "admin", "")
	if telResp.StatusCode != 200 || telJSON["service"] != "cd-runner" {
		t.Fatalf("telemetry failed: %d %#v", telResp.StatusCode, telJSON)
	}
	mResp, err := http.Get(ts.URL + "/metrics")
	if err != nil || mResp.StatusCode != 200 {
		t.Fatalf("metrics failed: %v", err)
	}
	mRaw, _ := io.ReadAll(mResp.Body)
	_ = mResp.Body.Close()
	if !bytes.Contains(mRaw, []byte("cd_runner_jobs_total")) {
		t.Fatalf("prometheus metrics missing cd_runner_jobs_total:\n%s", string(mRaw))
	}
	if !bytes.Contains(mRaw, []byte("cd_runner_fc_boot_ms")) {
		t.Fatalf("prometheus metrics missing cd_runner_fc_boot_ms:\n%s", string(mRaw))
	}
}

func waitZeroEnvs(t *testing.T, fake *fakeFCServer) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		fake.mu.Lock()
		n := len(fake.envs)
		fake.mu.Unlock()
		if n == 0 {
			return
		}
		time.Sleep(15 * time.Millisecond)
	}
	fake.mu.Lock()
	left := len(fake.envs)
	fake.mu.Unlock()
	t.Fatalf("expected 0 leftover microVMs, got %d", left)
}

func TestLiveJavaLeetCodeDAPBreakpointVarsAndStep(t *testing.T) {
	if _, err := exec.LookPath("javac"); err != nil {
		t.Skip("javac not installed locally")
	}
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node not installed locally")
	}

	drv := &LocalDriver{}
	if err := drv.Init(context.Background()); err != nil {
		t.Fatal(err)
	}
	secret := strings.Repeat("j", 36)
	srv := NewServer(Config{
		Node:         "lou1",
		Secret:       secret,
		DAPIdleMs:    15000,
		DAPMaxMs:     60000,
		DAPMaxActive: 4,
	}, drv, func(map[string]any) {})

	ts := httptest.NewServer(srv)
	defer ts.Close()

	hdrs := SignedHeaders(secret, "GET", "/v1/dap", "lou1", "java-user", nil, time.Now())
	q := url.Values{}
	q.Set("time", hdrs["x-runner-time"])
	q.Set("nonce", hdrs["x-runner-nonce"])
	q.Set("user", hdrs["x-runner-user"])
	q.Set("node", hdrs["x-runner-node"])
	q.Set("sig", hdrs["x-runner-signature"])

	conn, err := ws.Dial(context.Background(), "ws"+strings.TrimPrefix(ts.URL, "http")+"/v1/dap?"+q.Encode(), nil)
	if err != nil {
		t.Fatalf("ws dial failed: %v", err)
	}
	defer conn.Close()

	javaCode := strings.Join([]string{
		"class Solution {",                                              // line 1
		"    public int[] twoSum(int[] nums, int target) {",             // line 2
		"        Map<Integer, Integer> seen = new HashMap<>();",         // line 3
		"        for (int i = 0; i < nums.length; i++) {",               // line 4
		"            int need = target - nums[i];",                      // line 5 <- breakpoint!
		"            if (seen.containsKey(need)) return new int[]{seen.get(need), i};", // line 6
		"            seen.put(nums[i], i);",                             // line 7
		"        }",                                                     // line 8
		"        return new int[0];",                                    // line 9
		"    }",                                                         // line 10
		"}",                                                             // line 11
	}, "\n")

	if err := conn.WriteJSON(DAPInitRequest{
		Type:  "init",
		Lang:  "java",
		Mode:  "leetcode",
		Code:  javaCode,
		Sig:   json.RawMessage(`{"fn":"twoSum","params":["int[]","int"],"ret":"int[]"}`),
		Cases: []JobCase{{Input: json.RawMessage(`[[3, 2, 4], 6]`)}},
	}); err != nil {
		t.Fatal(err)
	}

	readUntil := func(match func(map[string]any) bool) map[string]any {
		_ = conn.SetReadDeadline(time.Now().Add(20 * time.Second))
		for {
			_, raw, rErr := conn.ReadMessage()
			if rErr != nil {
				t.Fatalf("ws read failed waiting for DAP message: %v", rErr)
			}
			var m map[string]any
			if json.Unmarshal(raw, &m) == nil && match(m) {
				return m
			}
		}
	}

	ready := readUntil(func(m map[string]any) bool { return m["type"] == "ready" || m["type"] == "compile_error" || m["type"] == "error" })
	if ready["type"] != "ready" {
		t.Fatalf("expected ready, got %#v", ready)
	}

	// 1. initialize -> setBreakpoints(line 5) -> launch -> configurationDone
	_ = conn.WriteJSON(map[string]any{"seq": 1, "type": "request", "command": "initialize"})
	readUntil(func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "initialize" })

	_ = conn.WriteJSON(map[string]any{
		"seq": 2, "type": "request", "command": "setBreakpoints",
		"arguments": map[string]any{"breakpoints": []map[string]any{{"line": 5}}},
	})
	readUntil(func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "setBreakpoints" })

	_ = conn.WriteJSON(map[string]any{"seq": 3, "type": "request", "command": "launch"})
	_ = conn.WriteJSON(map[string]any{"seq": 4, "type": "request", "command": "configurationDone"})

	stopped := readUntil(func(m map[string]any) bool { return m["type"] == "event" && m["event"] == "stopped" })
	threadID := int64(stopped["body"].(map[string]any)["threadId"].(float64))

	// 2. stackTrace -> verify editor line is mapped back to 5 (subtracting JudgeMain prelude offset!)
	_ = conn.WriteJSON(map[string]any{"seq": 5, "type": "request", "command": "stackTrace", "arguments": map[string]any{"threadId": threadID}})
	stResp := readUntil(func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "stackTrace" })
	frames := stResp["body"].(map[string]any)["stackFrames"].([]any)
	if len(frames) == 0 {
		t.Fatalf("expected non-empty stackFrames, got %#v", stResp)
	}
	topFrame := frames[0].(map[string]any)
	if int(topFrame["line"].(float64)) != 5 {
		t.Fatalf("expected mapped user line 5, got %#v", topFrame)
	}
	frameID := int(topFrame["id"].(float64))

	// 3. step over line 5 -> stops on line 6 -> evaluate "need" == "3" (6 - nums[0])!
	_ = conn.WriteJSON(map[string]any{"seq": 6, "type": "request", "command": "next", "arguments": map[string]any{"threadId": threadID}})
	readUntil(func(m map[string]any) bool { return m["type"] == "event" && m["event"] == "stopped" })

	_ = conn.WriteJSON(map[string]any{"seq": 7, "type": "request", "command": "stackTrace", "arguments": map[string]any{"threadId": threadID}})
	stResp2 := readUntil(func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "stackTrace" })
	frameID2 := int(stResp2["body"].(map[string]any)["stackFrames"].([]any)[0].(map[string]any)["id"].(float64))
	_ = frameID

	_ = conn.WriteJSON(map[string]any{"seq": 8, "type": "request", "command": "evaluate", "arguments": map[string]any{"expression": "need", "frameId": frameID2}})
	evalResp := readUntil(func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "evaluate" })
	if got := evalResp["body"].(map[string]any)["result"]; got != "3" {
		t.Fatalf("expected evaluate(need) == \"3\", got %#v", evalResp)
	}

	// 4. clear breakpoints -> continue -> program finishes cleanly -> disconnect
	_ = conn.WriteJSON(map[string]any{
		"seq": 9, "type": "request", "command": "setBreakpoints",
		"arguments": map[string]any{"breakpoints": []map[string]any{}},
	})
	readUntil(func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "setBreakpoints" })

	_ = conn.WriteJSON(map[string]any{"seq": 10, "type": "request", "command": "continue", "arguments": map[string]any{"threadId": threadID}})
	readUntil(func(m map[string]any) bool { return m["type"] == "event" && m["event"] == "terminated" })
	_ = conn.WriteJSON(map[string]any{"seq": 11, "type": "request", "command": "disconnect"})
}

func TestLiveJavaDAPViaDaemonAndPollProtocol(t *testing.T) {
	if _, err := exec.LookPath("javac"); err != nil {
		t.Skip("javac not installed locally")
	}
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node not installed locally")
	}

	dapScript := resolveLocalSandboxFile("dap-session.js")
	// Keep Unix domain socket path well below macOS 104-byte SUN_LEN limit.
	workspaceRoot, err := os.MkdirTemp("", "fc-dap-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(workspaceRoot) })
	workDir := filepath.Join(workspaceRoot, "work")
	if err := os.MkdirAll(workDir, 0o755); err != nil {
		t.Fatal(err)
	}

	fcToken := strings.Repeat("d", 40)
	var mu sync.Mutex
	envs := make(map[string]struct{})
	mapStateDir := func(guestDir string) string {
		clean := filepath.Clean(guestDir)
		rel := strings.TrimPrefix(clean, "/workspace/")
		if rel == clean {
			rel = filepath.Base(clean)
		}
		return filepath.Join(workspaceRoot, rel)
	}

	fakeFC := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true}, nil)
			return
		}
		if r.Header.Get("Authorization") != "Bearer "+fcToken {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"code": "unauthenticated"}, nil)
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/v1/envs" {
			id := "env-" + randomHex(4)
			mu.Lock()
			envs[id] = struct{}{}
			mu.Unlock()
			writeJSON(w, http.StatusCreated, map[string]any{"env_id": id, "runtime": "lc-runner"}, nil)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 3 && parts[0] == "v1" && parts[1] == "envs" {
			id := parts[2]
			if r.Method == http.MethodDelete && len(parts) == 3 {
				mu.Lock()
				delete(envs, id)
				mu.Unlock()
				w.WriteHeader(http.StatusNoContent)
				return
			}
			if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/agent/v1/exec") {
				var req struct {
					Argv      []string `json:"argv"`
					Stdin     string   `json:"stdin"`
					TimeoutMs int64    `json:"timeout_ms"`
				}
				_ = json.NewDecoder(r.Body).Decode(&req)
				stdinRaw, _ := base64.StdEncoding.DecodeString(req.Stdin)

				args := append([]string(nil), req.Argv...)
				if len(args) >= 4 {
					args[3] = mapStateDir(args[3])
				}
				cmd := exec.CommandContext(r.Context(), args[0], args[1:]...)
				cmd.Env = append(os.Environ(), "RUNNER_WORK="+workDir)
				cmd.Stdin = bytes.NewReader(stdinRaw)
				var stdout, stderr bytes.Buffer
				cmd.Stdout = &stdout
				cmd.Stderr = &stderr
				err := cmd.Run()
				code := 0
				if err != nil {
					code = 1
				}
				writeJSON(w, http.StatusOK, map[string]any{
					"exit_code": code,
					"timed_out": false,
					"stdout":    base64.StdEncoding.EncodeToString(stdout.Bytes()),
					"stderr":    base64.StdEncoding.EncodeToString(stderr.Bytes()),
				}, nil)
				return
			}
		}
		writeJSON(w, http.StatusNotFound, map[string]any{"code": "not_found"}, nil)
	}))
	defer fakeFC.Close()

	drv := NewFirecrackerDriver(FirecrackerConfig{
		URL:            fakeFC.URL,
		Token:          fcToken,
		DAPSessionPath: dapScript,
	})
	if err := drv.Init(context.Background()); err != nil {
		t.Fatal(err)
	}

	secret := strings.Repeat("m", 40)
	srv := NewServer(Config{
		Node:         "lou1",
		Secret:       secret,
		DAPIdleMs:    20000,
		DAPMaxMs:     60000,
		DAPMaxActive: 4,
	}, drv, func(map[string]any) {})
	ts := httptest.NewServer(srv)
	defer ts.Close()

	hdrs := SignedHeaders(secret, "GET", "/v1/dap", "lou1", "fc-java-user", nil, time.Now())
	q := url.Values{}
	q.Set("time", hdrs["x-runner-time"])
	q.Set("nonce", hdrs["x-runner-nonce"])
	q.Set("user", hdrs["x-runner-user"])
	q.Set("node", hdrs["x-runner-node"])
	q.Set("sig", hdrs["x-runner-signature"])

	conn, err := ws.Dial(context.Background(), "ws"+strings.TrimPrefix(ts.URL, "http")+"/v1/dap?"+q.Encode(), nil)
	if err != nil {
		t.Fatalf("ws dial failed: %v", err)
	}
	defer conn.Close()

	javaCode := strings.Join([]string{
		"class Solution {",
		"    public int[] twoSum(int[] nums, int target) {",
		"        Map<Integer, Integer> seen = new HashMap<>();",
		"        for (int i = 0; i < nums.length; i++) {",
		"            int need = target - nums[i];",
		"            if (seen.containsKey(need)) return new int[]{seen.get(need), i};",
		"            seen.put(nums[i], i);",
		"        }",
		"        return new int[0];",
		"    }",
		"}",
	}, "\n")

	if err := conn.WriteJSON(DAPInitRequest{
		Type:  "init",
		Lang:  "java",
		Mode:  "leetcode",
		Code:  javaCode,
		Sig:   json.RawMessage(`{"fn":"twoSum","params":["int[]","int"],"ret":"int[]"}`),
		Cases: []JobCase{{Input: json.RawMessage(`[[3, 2, 4], 6]`)}},
	}); err != nil {
		t.Fatal(err)
	}

	readUntil := func(label string, match func(map[string]any) bool) map[string]any {
		_ = conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		for {
			_, raw, rErr := conn.ReadMessage()
			if rErr != nil {
				t.Fatalf("ws read failed waiting for %s: %v", label, rErr)
			}
			var m map[string]any
			if json.Unmarshal(raw, &m) == nil && match(m) {
				return m
			}
		}
	}

	ready := readUntil("ready", func(m map[string]any) bool { return m["type"] == "ready" || m["type"] == "compile_error" || m["type"] == "error" })
	if ready["type"] != "ready" {
		t.Fatalf("expected ready from real daemon+poll, got %#v", ready)
	}
	_ = conn.WriteJSON(map[string]any{"seq": 1, "type": "request", "command": "initialize"})
	readUntil("initialize", func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "initialize" })

	_ = conn.WriteJSON(map[string]any{
		"seq": 2, "type": "request", "command": "setBreakpoints",
		"arguments": map[string]any{"breakpoints": []map[string]any{{"line": 5}}},
	})
	readUntil("setBreakpoints", func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "setBreakpoints" })

	_ = conn.WriteJSON(map[string]any{"seq": 3, "type": "request", "command": "launch"})
	_ = conn.WriteJSON(map[string]any{"seq": 4, "type": "request", "command": "configurationDone"})

	stopped := readUntil("stopped", func(m map[string]any) bool { return m["type"] == "event" && m["event"] == "stopped" })
	threadID := int64(stopped["body"].(map[string]any)["threadId"].(float64))

	_ = conn.WriteJSON(map[string]any{"seq": 5, "type": "request", "command": "stackTrace", "arguments": map[string]any{"threadId": threadID}})
	stResp := readUntil("stackTrace", func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "stackTrace" })
	frames := stResp["body"].(map[string]any)["stackFrames"].([]any)
	if len(frames) == 0 || int(frames[0].(map[string]any)["line"].(float64)) != 5 {
		t.Fatalf("expected stackTrace line 5 from daemon+poll, got %#v", stResp)
	}

	_ = conn.WriteJSON(map[string]any{"seq": 6, "type": "request", "command": "disconnect"})
	_ = conn.Close()

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		left := len(envs)
		mu.Unlock()
		if left == 0 {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("expected microVM env to be deleted on close")
}

func TestCppGdbDAPDefersLaunchUntilConfigurationDone(t *testing.T) {
	nodeBin, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not installed locally")
	}

	dapScript, err := filepath.Abs(filepath.Join("..", "..", "tools", "runner", "sandbox", "dap-session.js"))
	if err != nil {
		t.Fatal(err)
	}
	// Keep Unix domain socket path well below macOS 104-byte SUN_LEN limit.
	shortBase, err := os.MkdirTemp("", "fc-gdb-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(shortBase)

	mockBin := filepath.Join(shortBase, "bin")
	workDir := filepath.Join(shortBase, "work")
	if err := os.MkdirAll(mockBin, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(workDir, 0o755); err != nil {
		t.Fatal(err)
	}

	// Mock g++ just materializes the -o output binary.
	gppScript := `#!/bin/sh
out="prog"
while [ $# -gt 0 ]; do
  if [ "$1" = "-o" ] && [ $# -gt 1 ]; then
    out="$2"
    shift 2
    continue
  fi
  shift
done
printf '#!/bin/sh\nexit 0\n' > "$out"
chmod +x "$out"
`
	if err := os.WriteFile(filepath.Join(mockBin, "g++"), []byte(gppScript), 0o755); err != nil {
		t.Fatal(err)
	}

	cmdLogPath := filepath.Join(shortBase, "commands.json")
	mockGdbJS := fmt.Sprintf(`#!%s
const fs = require("fs");
let buf = Buffer.alloc(0);
let seq = 1;
let bpLine = null;
const commands = [];
const writeFrame = (obj) => {
  const b = Buffer.from(JSON.stringify(obj), "utf8");
  process.stdout.write("Content-Length: " + b.length + "\r\n\r\n");
  process.stdout.write(b);
};
const handle = (msg) => {
  if (msg.type !== "request") return;
  commands.push(msg.command);
  fs.writeFileSync(%q, JSON.stringify(commands));
  if (msg.command === "initialize") {
    writeFrame({ seq: seq++, type: "response", request_seq: msg.seq, success: true, command: "initialize" });
    writeFrame({ seq: seq++, type: "event", event: "initialized" });
  } else if (msg.command === "setBreakpoints") {
    const bps = (msg.arguments && msg.arguments.breakpoints) || [];
    bpLine = bps[0] ? bps[0].line : null;
    writeFrame({ seq: seq++, type: "response", request_seq: msg.seq, success: true, command: "setBreakpoints", body: { breakpoints: [{ verified: bpLine !== null, line: bpLine }] } });
  } else if (msg.command === "launch") {
    writeFrame({ seq: seq++, type: "response", request_seq: msg.seq, success: true, command: "launch" });
    if (bpLine !== null) {
      writeFrame({ seq: seq++, type: "event", event: "stopped", body: { reason: "breakpoint", threadId: 1 } });
    } else {
      // Simulate GDB 15 launching and exiting before breakpoints arrive.
      writeFrame({ seq: seq++, type: "event", event: "exited", body: { exitCode: 0 } });
      writeFrame({ seq: seq++, type: "event", event: "terminated" });
    }
  } else if (msg.command === "configurationDone") {
    writeFrame({ seq: seq++, type: "response", request_seq: msg.seq, success: true, command: "configurationDone" });
  } else if (msg.command === "stackTrace") {
    writeFrame({ seq: seq++, type: "response", request_seq: msg.seq, success: true, command: "stackTrace", body: { stackFrames: [{ id: 1, name: "twoSum", line: bpLine || 1, source: { name: "main.cpp", path: "main.cpp" } }] } });
  } else if (msg.command === "disconnect") {
    writeFrame({ seq: seq++, type: "response", request_seq: msg.seq, success: true, command: "disconnect" });
    process.exit(0);
  }
};
process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const sep = buf.indexOf("\r\n\r\n");
    if (sep < 0) break;
    const m = buf.slice(0, sep).toString("ascii").match(/Content-Length:\s*(\d+)/i);
    if (!m) { buf = buf.slice(sep + 4); continue; }
    const len = Number(m[1]);
    if (buf.length < sep + 4 + len) break;
    const body = buf.slice(sep + 4, sep + 4 + len).toString("utf8");
    buf = buf.slice(sep + 4 + len);
    handle(JSON.parse(body));
  }
});
`, nodeBin, cmdLogPath)
	if err := os.WriteFile(filepath.Join(mockBin, "gdb"), []byte(mockGdbJS), 0o755); err != nil {
		t.Fatal(err)
	}

	const fcToken = "fc-gdb-token-012345678901234567890"
	var mu sync.Mutex
	envs := map[string]struct{}{}
	mapStateDir := func(guestDir string) string {
		return filepath.Join(shortBase, filepath.Base(guestDir))
	}

	fakeFC := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true}, nil)
			return
		}
		if r.URL.Path == "/v1/envs" && r.Method == http.MethodPost {
			mu.Lock()
			envs["vm-gdb"] = struct{}{}
			mu.Unlock()
			writeJSON(w, http.StatusCreated, map[string]any{"env_id": "vm-gdb", "runtime": "lc-runner"}, nil)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 3 && parts[0] == "v1" && parts[1] == "envs" {
			id := parts[2]
			if r.Method == http.MethodDelete && len(parts) == 3 {
				mu.Lock()
				delete(envs, id)
				mu.Unlock()
				w.WriteHeader(http.StatusNoContent)
				return
			}
			if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/agent/v1/exec") {
				var req struct {
					Argv  []string `json:"argv"`
					Stdin string   `json:"stdin"`
				}
				_ = json.NewDecoder(r.Body).Decode(&req)
				stdinRaw, _ := base64.StdEncoding.DecodeString(req.Stdin)
				args := append([]string(nil), req.Argv...)
				if len(args) >= 4 {
					args[3] = mapStateDir(args[3])
				}
				cmd := exec.CommandContext(r.Context(), args[0], args[1:]...)
				cmd.Env = append(os.Environ(),
					"RUNNER_WORK="+workDir,
					"PATH="+mockBin+string(os.PathListSeparator)+os.Getenv("PATH"),
				)
				cmd.Stdin = bytes.NewReader(stdinRaw)
				var stdout, stderr bytes.Buffer
				cmd.Stdout = &stdout
				cmd.Stderr = &stderr
				code := 0
				if cmd.Run() != nil {
					code = 1
				}
				writeJSON(w, http.StatusOK, map[string]any{
					"exit_code": code,
					"timed_out": false,
					"stdout":    base64.StdEncoding.EncodeToString(stdout.Bytes()),
					"stderr":    base64.StdEncoding.EncodeToString(stderr.Bytes()),
				}, nil)
				return
			}
		}
		writeJSON(w, http.StatusNotFound, map[string]any{"code": "not_found"}, nil)
	}))
	defer fakeFC.Close()

	drv := NewFirecrackerDriver(FirecrackerConfig{
		URL:            fakeFC.URL,
		Token:          fcToken,
		DAPSessionPath: dapScript,
	})
	if err := drv.Init(context.Background()); err != nil {
		t.Fatal(err)
	}
	secret := strings.Repeat("g", 40)
	srv := NewServer(Config{Node: "lou1", Secret: secret, DAPIdleMs: 15000, DAPMaxMs: 60000, DAPMaxActive: 4}, drv, func(map[string]any) {})
	ts := httptest.NewServer(srv)
	defer ts.Close()

	hdrs := SignedHeaders(secret, "GET", "/v1/dap", "lou1", "fc-cpp-user", nil, time.Now())
	q := url.Values{}
	q.Set("time", hdrs["x-runner-time"])
	q.Set("nonce", hdrs["x-runner-nonce"])
	q.Set("user", hdrs["x-runner-user"])
	q.Set("node", hdrs["x-runner-node"])
	q.Set("sig", hdrs["x-runner-signature"])

	conn, err := ws.Dial(context.Background(), "ws"+strings.TrimPrefix(ts.URL, "http")+"/v1/dap?"+q.Encode(), nil)
	if err != nil {
		t.Fatalf("ws dial failed: %v", err)
	}
	defer conn.Close()

	cppCode := strings.Join([]string{
		"class Solution {",
		"public:",
		"    vector<int> twoSum(vector<int>& nums, int target) {",
		"        unordered_map<int, int> seen;",
		"        for (int i = 0; i < (int)nums.size(); i++) {",
		"            int need = target - nums[i];",
		"            if (seen.count(need)) return {seen[need], i};",
		"            seen[nums[i]] = i;",
		"        }",
		"        return {};",
		"    }",
		"};",
	}, "\n")
	if err := conn.WriteJSON(DAPInitRequest{
		Type:  "init",
		Lang:  "cpp",
		Mode:  "leetcode",
		Code:  cppCode,
		Sig:   json.RawMessage(`{"fn":"twoSum","params":["int[]","int"],"ret":"int[]"}`),
		Cases: []JobCase{{Input: json.RawMessage(`[[3, 2, 4], 6]`)}},
	}); err != nil {
		t.Fatal(err)
	}

	launchRespCount := 0
	readUntil := func(label string, match func(map[string]any) bool) map[string]any {
		_ = conn.SetReadDeadline(time.Now().Add(20 * time.Second))
		for {
			_, raw, rErr := conn.ReadMessage()
			if rErr != nil {
				t.Fatalf("ws read failed waiting for %s: %v", label, rErr)
			}
			var m map[string]any
			if json.Unmarshal(raw, &m) == nil {
				if m["type"] == "response" && m["command"] == "launch" {
					launchRespCount++
				}
				if match(m) {
					return m
				}
			}
		}
	}

	ready := readUntil("ready", func(m map[string]any) bool { return m["type"] == "ready" || m["type"] == "error" || m["type"] == "compile_error" })
	if ready["type"] != "ready" {
		t.Fatalf("expected ready, got %#v", ready)
	}
	// Mirror sandbox.test.mjs sequence where initialize + launch precede setBreakpoints + configurationDone.
	_ = conn.WriteJSON(map[string]any{"seq": 1, "type": "request", "command": "initialize"})
	readUntil("initialize", func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "initialize" })
	_ = conn.WriteJSON(map[string]any{"seq": 2, "type": "request", "command": "launch", "arguments": map[string]any{}})
	readUntil("initialized", func(m map[string]any) bool { return m["type"] == "event" && m["event"] == "initialized" })
	_ = conn.WriteJSON(map[string]any{"seq": 3, "type": "request", "command": "setBreakpoints", "arguments": map[string]any{"breakpoints": []map[string]any{{"line": 6}}}})
	readUntil("setBreakpoints", func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "setBreakpoints" })
	_ = conn.WriteJSON(map[string]any{"seq": 4, "type": "request", "command": "configurationDone", "arguments": map[string]any{}})

	stopped := readUntil("stopped", func(m map[string]any) bool { return m["type"] == "event" && m["event"] == "stopped" })
	tid := int64(stopped["body"].(map[string]any)["threadId"].(float64))
	_ = conn.WriteJSON(map[string]any{"seq": 5, "type": "request", "command": "stackTrace", "arguments": map[string]any{"threadId": tid}})
	stResp := readUntil("stackTrace", func(m map[string]any) bool { return m["type"] == "response" && m["command"] == "stackTrace" })
	frames := stResp["body"].(map[string]any)["stackFrames"].([]any)
	if len(frames) == 0 || int(frames[0].(map[string]any)["line"].(float64)) != 6 {
		t.Fatalf("expected stackTrace mapped back to line 6, got %#v", stResp)
	}
	_ = conn.WriteJSON(map[string]any{"seq": 6, "type": "request", "command": "disconnect"})
	_ = conn.Close()

	if launchRespCount != 1 {
		t.Fatalf("expected exactly 1 launch response delivered to client, got %d", launchRespCount)
	}
	rawCmds, err := os.ReadFile(cmdLogPath)
	if err != nil {
		t.Fatal(err)
	}
	var gotCmds []string
	if err := json.Unmarshal(rawCmds, &gotCmds); err != nil {
		t.Fatal(err)
	}
	// Verify GDB received setBreakpoints BEFORE deferred launch + configurationDone.
	wantPrefix := []string{"initialize", "setBreakpoints", "launch", "configurationDone"}
	if len(gotCmds) < len(wantPrefix) {
		t.Fatalf("unexpected command order: %v", gotCmds)
	}
	for i, w := range wantPrefix {
		if gotCmds[i] != w {
			t.Fatalf("command[%d] = %q, want %q (all: %v)", i, gotCmds[i], w, gotCmds)
		}
	}
}
