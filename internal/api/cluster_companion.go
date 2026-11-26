package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/runner"
	"github.com/Hanwen-Jiang/coding-dance/internal/ws"
)

type RunnerNode struct {
	ID  string
	URL string
}

type NodeStatus struct {
	Node       string   `json:"node"`
	Langs      []string `json:"langs"`
	DebugLangs []string `json:"debugLangs"`
	Features   []string `json:"features"`
	Slots      int      `json:"slots"`
	Queue      int      `json:"queue"`
	Busy       int      `json:"busy"`
	Queued     int      `json:"queued"`
	DapActive  int      `json:"dapActive"`
	Version    string   `json:"version"`
}

var langRequiredFeatures = map[string]string{
	"typescript": "ts-transform",
}

func ParseRunnerNodes(raw string) []RunnerNode {
	var out []RunnerNode
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		id, rawURL, ok := strings.Cut(part, "=")
		if !ok || !runner.NodeIDPattern.MatchString(id) {
			continue
		}
		if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
			continue
		}
		dup := false
		for _, n := range out {
			if n.ID == id {
				dup = true
				break
			}
		}
		if !dup {
			out = append(out, RunnerNode{ID: id, URL: strings.TrimRight(rawURL, "/")})
		}
	}
	return out
}

// fnvUnit matches site/functions/_lib/runner.ts unit(s) (32-bit FNV-1a mapped to (0, 1)).
func fnvUnit(s string) float64 {
	var h uint32 = 0x811c9dc5
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 0x01000193
	}
	return (float64(h) + 0.5) / 4294967296.0
}

type nodeSeen struct {
	at        time.Time
	status    *NodeStatus
	downUntil time.Time
	busyUntil time.Time
}

// ClusterRouter routes /api/run and /api/dap to cd-runner nodes using weighted rendezvous hashing.
type ClusterRouter struct {
	Nodes        []RunnerNode
	Secret       string
	AccessID     string
	AccessSecret string
	HTTPClient   *http.Client

	mu   sync.Mutex
	seen map[string]nodeSeen
}

func NewClusterRouter(nodes []RunnerNode, secret, accessID, accessSecret string) *ClusterRouter {
	return &ClusterRouter{
		Nodes:        nodes,
		Secret:       secret,
		AccessID:     accessID,
		AccessSecret: accessSecret,
		HTTPClient:   &http.Client{Timeout: 95 * time.Second},
		seen:         make(map[string]nodeSeen),
	}
}

func (c *ClusterRouter) Configured() bool {
	return len(c.Nodes) > 0 && len(c.Secret) >= 32
}

func (c *ClusterRouter) callNode(ctx context.Context, node RunnerNode, method, path, user string, body []byte, timeout time.Duration) (*http.Response, error) {
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}
	var reader io.Reader
	if method == http.MethodPost {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, node.URL+path, reader)
	if err != nil {
		return nil, err
	}
	for k, v := range runner.SignedHeaders(c.Secret, method, path, node.ID, user, body, time.Now()) {
		req.Header.Set(k, v)
	}
	if method == http.MethodPost {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.AccessID != "" && c.AccessSecret != "" {
		req.Header.Set("CF-Access-Client-Id", c.AccessID)
		req.Header.Set("CF-Access-Client-Secret", c.AccessSecret)
	}
	return c.HTTPClient.Do(req)
}

func (c *ClusterRouter) RefreshStatuses(ctx context.Context) []*NodeStatus {
	now := time.Now()
	var wg sync.WaitGroup
	for _, node := range c.Nodes {
		c.mu.Lock()
		e := c.seen[node.ID]
		fresh := !e.at.IsZero() && now.Sub(e.at) < 15*time.Second
		c.mu.Unlock()
		if fresh {
			continue
		}
		wg.Add(1)
		go func(n RunnerNode) {
			defer wg.Done()
			resp, err := c.callNode(ctx, n, http.MethodGet, "/v1/status", "", nil, 2*time.Second)
			var st *NodeStatus
			if err == nil && resp != nil {
				if resp.StatusCode == http.StatusOK {
					var parsed NodeStatus
					if json.NewDecoder(resp.Body).Decode(&parsed) == nil {
						st = &parsed
					}
				}
				_ = resp.Body.Close()
			}
			c.mu.Lock()
			prev := c.seen[n.ID]
			prev.at = now
			prev.status = st
			if st != nil {
				prev.downUntil = time.Time{}
			} else {
				prev.downUntil = now.Add(30 * time.Second)
			}
			c.seen[n.ID] = prev
			c.mu.Unlock()
		}(node)
	}
	wg.Wait()

	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]*NodeStatus, len(c.Nodes))
	for i, n := range c.Nodes {
		out[i] = c.seen[n.ID].status
	}
	return out
}

func nodeFits(s *NodeStatus, lang string, debug bool) bool {
	if s == nil || lang == "" {
		return true
	}
	langs := s.Langs
	if debug {
		langs = s.DebugLangs
	}
	if len(langs) > 0 && !slices.Contains(langs, lang) {
		return false
	}
	if need := langRequiredFeatures[lang]; need != "" && !slices.Contains(s.Features, need) {
		return false
	}
	return true
}

func (c *ClusterRouter) PickOrder(user, lang string, debug bool, now time.Time) []RunnerNode {
	type scored struct {
		node  RunnerNode
		rank  int
		score float64
	}
	c.mu.Lock()
	items := make([]scored, len(c.Nodes))
	for i, n := range c.Nodes {
		e := c.seen[n.ID]
		s := e.status
		weight := 1.0
		if s != nil && s.Slots > 1 {
			weight = float64(s.Slots)
		}
		sc := -weight / math.Log(fnvUnit(user+"\n"+n.ID))
		unfit := !nodeFits(s, lang, debug)
		down := now.Before(e.downUntil)
		busy := now.Before(e.busyUntil) || (s != nil && s.Slots > 0 && s.Busy >= s.Slots && s.Queued >= s.Queue)
		rank := 0
		if unfit {
			rank = 3
		} else if down {
			rank = 2
		} else if busy {
			rank = 1
		}
		items[i] = scored{node: n, rank: rank, score: sc}
	}
	c.mu.Unlock()

	sort.SliceStable(items, func(i, j int) bool {
		if items[i].rank != items[j].rank {
			return items[i].rank < items[j].rank
		}
		return items[i].score > items[j].score
	})
	out := make([]RunnerNode, len(items))
	for i, x := range items {
		out[i] = x.node
	}
	return out
}

func (c *ClusterRouter) markBusy(id string) {
	c.mu.Lock()
	e := c.seen[id]
	e.busyUntil = time.Now().Add(5 * time.Second)
	c.seen[id] = e
	c.mu.Unlock()
}

func (c *ClusterRouter) markDown(id string) {
	c.mu.Lock()
	e := c.seen[id]
	e.downUntil = time.Now().Add(30 * time.Second)
	c.seen[id] = e
	c.mu.Unlock()
}

func (c *ClusterRouter) Run(ctx context.Context, user string, body []byte, lang string, debug bool) (status int, respBody []byte, tried []string) {
	c.RefreshStatuses(ctx)
	for _, node := range c.PickOrder(user, lang, debug, time.Now()) {
		tried = append(tried, node.ID)
		resp, err := c.callNode(ctx, node, http.MethodPost, "/v1/run", user, body, 95*time.Second)
		if err != nil {
			c.markDown(node.ID)
			continue
		}
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusServiceUnavailable {
			c.markBusy(node.ID)
			continue
		}
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode >= 500 {
			c.markDown(node.ID)
			continue
		}
		return resp.StatusCode, raw, tried
	}
	return 0, nil, tried
}

// ProxyDAP upgrades the browser WebSocket and bridges it to the pinned cd-runner node's /v1/dap.
func (c *ClusterRouter) ProxyDAP(w http.ResponseWriter, r *http.Request, user, lang string) {
	c.RefreshStatuses(r.Context())
	order := c.PickOrder(user, lang, true, time.Now())
	if len(order) == 0 {
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "没有可用的云端调试节点"})
		return
	}
	var upConn *ws.Conn
	for _, node := range order {
		hdrs := runner.SignedHeaders(c.Secret, http.MethodGet, "/v1/dap", node.ID, user, nil, time.Now())
		q := url.Values{}
		q.Set("time", hdrs["x-runner-time"])
		q.Set("nonce", hdrs["x-runner-nonce"])
		q.Set("user", hdrs["x-runner-user"])
		q.Set("node", hdrs["x-runner-node"])
		q.Set("sig", hdrs["x-runner-signature"])
		wsBase := strings.Replace(node.URL, "https://", "wss://", 1)
		wsBase = strings.Replace(wsBase, "http://", "ws://", 1)
		dialHdr := make(http.Header)
		if c.AccessID != "" && c.AccessSecret != "" {
			dialHdr.Set("CF-Access-Client-Id", c.AccessID)
			dialHdr.Set("CF-Access-Client-Secret", c.AccessSecret)
		}
		conn, err := ws.Dial(r.Context(), wsBase+"/v1/dap?"+q.Encode(), dialHdr)
		if err == nil {
			upConn = conn
			break
		}
		c.markDown(node.ID)
	}
	if upConn == nil {
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "云端调试节点暂时都不可达"})
		return
	}
	defer upConn.Close()

	downConn, err := ws.Upgrade(w, r)
	if err != nil {
		return
	}
	defer downConn.Close()

	done := make(chan struct{}, 2)
	pipe := func(src, dst *ws.Conn) {
		defer func() { done <- struct{}{} }()
		for {
			_, msg, err := src.ReadMessage()
			if err != nil {
				return
			}
			if err := dst.WriteText(msg); err != nil {
				return
			}
		}
	}
	go pipe(downConn, upConn)
	go pipe(upConn, downConn)
	<-done
}

// Telemetry aggregates real-time status & OTel telemetry across all configured cd-runner nodes for #/admin.
func (c *ClusterRouter) Telemetry(ctx context.Context) map[string]any {
	type nodeTelemetry struct {
		ID        string         `json:"id"`
		URL       string         `json:"url"`
		Online    bool           `json:"online"`
		Status    *NodeStatus    `json:"status"`
		Telemetry map[string]any `json:"telemetry"`
	}
	items := make([]nodeTelemetry, len(c.Nodes))
	var wg sync.WaitGroup
	wg.Add(len(c.Nodes))
	for i, node := range c.Nodes {
		idx, n := i, node
		go func() {
			defer wg.Done()
			it := nodeTelemetry{ID: n.ID, URL: n.URL}
			var st *NodeStatus
			var tel map[string]any
			var innerWG sync.WaitGroup
			innerWG.Add(2)
			go func() {
				defer innerWG.Done()
				resp, err := c.callNode(ctx, n, http.MethodGet, "/v1/status", "admin", nil, 3*time.Second)
				if err == nil && resp != nil {
					if resp.StatusCode == http.StatusOK {
						var parsed NodeStatus
						if json.NewDecoder(resp.Body).Decode(&parsed) == nil {
							st = &parsed
						}
					}
					_ = resp.Body.Close()
				}
			}()
			go func() {
				defer innerWG.Done()
				resp, err := c.callNode(ctx, n, http.MethodGet, "/v1/admin/telemetry", "admin", nil, 3*time.Second)
				if err == nil && resp != nil {
					if resp.StatusCode == http.StatusOK {
						_ = json.NewDecoder(resp.Body).Decode(&tel)
					}
					_ = resp.Body.Close()
				}
			}()
			innerWG.Wait()
			it.Status = st
			it.Telemetry = tel
			it.Online = st != nil
			items[idx] = it
		}()
	}
	wg.Wait()

	online, totalSlots, busySlots, queuedJobs, activeDAP := 0, 0, 0, 0, 0
	for _, x := range items {
		if x.Online && x.Status != nil {
			online++
			totalSlots += x.Status.Slots
			busySlots += x.Status.Busy
			queuedJobs += x.Status.Queued
			activeDAP += x.Status.DapActive
		}
	}
	return map[string]any{
		"ok":        true,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"summary": map[string]int{
			"totalNodes":        len(c.Nodes),
			"onlineNodes":       online,
			"totalSlots":        totalSlots,
			"busySlots":         busySlots,
			"queuedJobs":        queuedJobs,
			"activeDapSessions": activeDAP,
		},
		"nodes": items,
	}
}

// —— Consent-First Companion Proxy (100% compatible with site/functions/_lib/companion.ts) ——

var nonSlugChars = regexp.MustCompile(`[^a-z0-9_-]`)

func SanitizeCompanionUser(login string) string {
	raw := strings.ToLower(strings.TrimSpace(login))
	raw = nonSlugChars.ReplaceAllString(raw, "-")
	raw = strings.TrimLeft(raw, "-")
	if raw == "" {
		return "guest"
	}
	out := "gh-" + raw
	if len(out) > 63 {
		out = out[:63]
	}
	return out
}

type CompanionGateway struct {
	AgentURL   string
	APIToken   string
	WebhookURL string
	WebhookKey string
	HTTPClient *http.Client

	mu      sync.Mutex
	buckets map[string][]time.Time
}

func NewCompanionGateway(agentURL, token, webhookURL, webhookKey string) *CompanionGateway {
	return &CompanionGateway{
		AgentURL:   strings.TrimRight(strings.TrimSpace(agentURL), "/"),
		APIToken:   strings.TrimSpace(token),
		WebhookURL: strings.TrimSpace(webhookURL),
		WebhookKey: strings.TrimSpace(webhookKey),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
		buckets:    make(map[string][]time.Time),
	}
}

func (cg *CompanionGateway) Configured() bool {
	return cg.AgentURL != "" && cg.APIToken != ""
}

func (cg *CompanionGateway) admit(actor string, now time.Time) bool {
	cg.mu.Lock()
	defer cg.mu.Unlock()
	hits := cg.buckets[actor]
	kept := hits[:0]
	for _, ts := range hits {
		if now.Sub(ts) < time.Minute {
			kept = append(kept, ts)
		}
	}
	if len(kept) >= 30 {
		cg.buckets[actor] = kept
		return false
	}
	kept = append(kept, now)
	cg.buckets[actor] = kept
	return true
}

func (cg *CompanionGateway) Forward(w http.ResponseWriter, r *http.Request, endpoint string, sess *Session, requireAuth bool) {
	if !cg.Configured() {
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "伴学服务暂未配置"})
		return
	}
	if requireAuth && sess == nil {
		writePrivateJSON(w, http.StatusUnauthorized, map[string]any{"error": "请先用 GitHub 登录后再使用历史复盘"})
		return
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, 131073))
	if err != nil || len(raw) > 131072 {
		writePrivateJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"error": "请求内容过大（上限 128 KB）"})
		return
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil || body == nil {
		writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "请求体必须是 JSON 对象"})
		return
	}
	actor := "ip:" + r.RemoteAddr
	login := ""
	if sess != nil {
		actor = "u:" + sess.Login
		login = sess.Login
	}
	if !cg.admit(actor, time.Now()) {
		writePrivateJSON(w, http.StatusTooManyRequests, map[string]any{"error": "伴学请求过于频繁，请稍后再试"})
		return
	}

	// Defense-in-depth Consent-First enforcement
	if endpoint == "hint-reveal" || endpoint == "history-analyze" {
		if body["consent_mode"] == "off" {
			writePrivateJSON(w, http.StatusForbidden, map[string]any{"error": "当前处于隐私静默模式（off），已阻止生成提示或分析"})
			return
		}
		if consented, _ := body["user_consented"].(bool); !consented {
			writePrivateJSON(w, http.StatusForbidden, map[string]any{"error": "需要明确点击同意后才显示提示或复盘"})
			return
		}
	}
	if endpoint == "hint-reveal" && sess == nil && body["mode"] == "runtime" {
		body["mode"] = "fast"
	}

	slug := SanitizeCompanionUser(login)
	encoded, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, cg.AgentURL+"/api/integrations/coding-dance/v1/"+endpoint, bytes.NewReader(encoded))
	if err != nil {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": "伴学网关暂时不可达，请稍后再试"})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cg.APIToken)
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; CodingDanceCompanion/1.0)")
	req.Header.Set("X-Coding-Dance-User", slug)
	if sess != nil {
		req.Header.Set("X-Coding-Dance-Tenant", slug)
	}
	resp, err := cg.HTTPClient.Do(req)
	if err != nil {
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"error": "伴学网关暂时不可达，请稍后再试"})
		return
	}
	defer resp.Body.Close()
	upRaw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	var payload any
	if json.Unmarshal(upRaw, &payload) != nil {
		payload = map[string]any{"error": "伴学服务暂时不可用"}
	}
	outStatus := resp.StatusCode
	if outStatus >= 500 {
		outStatus = http.StatusBadGateway
	}
	writePrivateJSON(w, outStatus, payload)
}
