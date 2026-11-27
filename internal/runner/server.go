package runner

import (
	"encoding/json"
	"errors"
	"io"
	"maps"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/otel"
)

const MaxBodyBytes = 2 << 20 // 2 MiB

type Config struct {
	Node         string
	Port         int
	Host         string
	Secret       string
	Driver       string
	FCURL        string
	FCToken      string
	FCTokenFile  string
	FCRuntime    string
	FCCPUMillis  int
	FCMemoryMB   int
	Image        string
	Runtime      string
	Pool         int
	Slots        int
	Queue        int
	Memory       string
	CPUs         string
	PIDs         int
	PerMinute    int
	CaseMs       int
	TotalMs      int
	JobMs        int
	DAPIdleMs    int
	DAPMaxMs     int
	DAPMaxActive int
	OTLPEndpoint string
	Version      string
}

func LoadConfigFromEnv() Config {
	num := func(key string, def int) int {
		v := os.Getenv(key)
		if v == "" {
			return def
		}
		n, err := strconv.Atoi(v)
		if err != nil {
			return def
		}
		return n
	}
	str := func(key, def string) string {
		if v := os.Getenv(key); v != "" {
			return v
		}
		return def
	}
	return Config{
		Node:         str("RUNNER_NODE_ID", ""),
		Port:         num("RUNNER_PORT", 8790),
		Host:         str("RUNNER_HOST", "127.0.0.1"),
		Secret:       str("RUNNER_SECRET", ""),
		Driver:       str("RUNNER_DRIVER", "firecracker"),
		FCURL:        str("RUNNER_FC_URL", "http://127.0.0.1:8097"),
		FCToken:      str("RUNNER_FC_TOKEN", ""),
		FCTokenFile:  str("RUNNER_FC_TOKEN_FILE", "/etc/agentruntime/fc-manager-secrets.json"),
		FCRuntime:    str("RUNNER_FC_RUNTIME", "lc-runner"),
		FCCPUMillis:  num("RUNNER_FC_CPU_MILLIS", 1000),
		FCMemoryMB:   num("RUNNER_FC_MEMORY_MB", 1024),
		Image:        str("RUNNER_IMAGE", "lc-runner:latest"),
		Runtime:      str("RUNNER_RUNTIME", ""),
		Pool:         num("RUNNER_POOL", 2),
		Slots:        num("RUNNER_SLOTS", 2),
		Queue:        num("RUNNER_QUEUE", 20),
		Memory:       str("RUNNER_MEMORY", "1g"),
		CPUs:         str("RUNNER_CPUS", "1"),
		PIDs:         num("RUNNER_PIDS", 256),
		PerMinute:    num("RUNNER_USER_PER_MIN", 20),
		CaseMs:       num("RUNNER_CASE_MS", 3000),
		TotalMs:      num("RUNNER_TOTAL_MS", 30000),
		JobMs:        num("RUNNER_JOB_MS", 90000),
		DAPIdleMs:    num("RUNNER_DAP_IDLE_MS", 300000),
		DAPMaxMs:     num("RUNNER_DAP_MAX_MS", 1800000),
		DAPMaxActive: num("RUNNER_DAP_MAX_SESSIONS", 8),
		OTLPEndpoint: str("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
		Version:      str("RUNNER_VERSION", "dev"),
	}
}

type Server struct {
	cfg     Config
	driver  Driver
	nonces  *NonceCache
	limits  *UserLimits
	slots   *Slots
	dap     *DAPManager
	metrics *otel.Registry
	logFn   func(map[string]any)
}

func NewServer(cfg Config, driver Driver, logFn func(map[string]any)) *Server {
	if cfg.Slots <= 0 {
		cfg.Slots = 2
	}
	if cfg.PerMinute <= 0 {
		cfg.PerMinute = 20
	}
	if cfg.CaseMs <= 0 {
		cfg.CaseMs = 3000
	}
	if cfg.TotalMs <= 0 {
		cfg.TotalMs = 30000
	}
	if cfg.JobMs <= 0 {
		cfg.JobMs = 90000
	}
	if logFn == nil {
		logFn = DefaultJSONLogger
	}
	metrics := otel.NewRegistry("cd-runner", cfg.Node)
	slots := NewSlots(cfg.Slots, cfg.Queue)
	metrics.RegisterGaugeFunc("cd_runner_slots_capacity", func() float64 { return float64(cfg.Slots) })
	metrics.RegisterGaugeFunc("cd_runner_slots_busy", func() float64 {
		b, _ := slots.Counts()
		return float64(b)
	})
	metrics.RegisterGaugeFunc("cd_runner_queue_waiting", func() float64 {
		_, q := slots.Counts()
		return float64(q)
	})
	dapMgr := NewDAPManager(
		driver,
		time.Duration(cfg.DAPIdleMs)*time.Millisecond,
		time.Duration(cfg.DAPMaxMs)*time.Millisecond,
		cfg.DAPMaxActive,
		metrics,
		logFn,
	)
	return &Server{
		cfg:     cfg,
		driver:  driver,
		nonces:  NewNonceCache(0),
		limits:  NewUserLimits(cfg.PerMinute),
		slots:   slots,
		dap:     dapMgr,
		metrics: metrics,
		logFn:   logFn,
	}
}

func DefaultJSONLogger(fields map[string]any) {
	out := make(map[string]any, len(fields)+1)
	out["t"] = time.Now().UTC().Format(time.RFC3339Nano)
	maps.Copy(out, fields)
	b, err := json.Marshal(out)
	if err == nil {
		_, _ = os.Stdout.Write(append(b, '\n'))
	}
}

func (s *Server) DAP() *DAPManager       { return s.dap }
func (s *Server) Metrics() *otel.Registry { return s.metrics }

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if r.Method == http.MethodGet && path == "/healthz" {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true}, nil)
		return
	}
	if r.Method == http.MethodGet && path == "/metrics" {
		s.metrics.PrometheusHandler().ServeHTTP(w, r)
		return
	}

	body, ok := readBoundedBody(w, r, MaxBodyBytes)
	if !ok {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"error": "请求太大了"}, nil)
		return
	}

	allowQuery := r.Method == http.MethodGet && path == "/v1/dap"
	auth := Verify(s.cfg.Secret, VerifyInput{
		Method:         r.Method,
		Path:           path,
		Headers:        r.Header,
		Query:          r.URL.Query(),
		AllowQueryAuth: allowQuery,
		Body:           body,
		Node:           s.cfg.Node,
		Nonces:         s.nonces,
	})
	if !auth.OK {
		s.metrics.IncCounter("cd_runner_auth_denied_total", map[string]string{"path": path})
		s.logFn(map[string]any{"event": "denied", "path": path, "reason": auth.Reason})
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": auth.Reason}, nil)
		return
	}

	if r.Method == http.MethodGet && path == "/v1/status" {
		busy, queued := s.slots.Counts()
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":         true,
			"node":       s.cfg.Node,
			"version":    s.cfg.Version,
			"langs":           Langs,
			"debugLangs":      DebugLangs,
			"traceDebugLangs": TraceDebugLangs,
			"features":        Features,
			"pool":       s.driver.Status(),
			"slots":      s.cfg.Slots,
			"queue":      s.cfg.Queue,
			"busy":       busy,
			"queued":     queued,
			"dapActive":  s.dap.ActiveCount(),
			"limits": map[string]any{
				"caseMs":    s.cfg.CaseMs,
				"totalMs":   s.cfg.TotalMs,
				"perMinute": s.cfg.PerMinute,
				"cases":     100,
				"steps":     1000,
			},
		}, nil)
		return
	}

	if r.Method == http.MethodGet && path == "/v1/admin/telemetry" {
		writeJSON(w, http.StatusOK, s.metrics.Snapshot(), nil)
		return
	}

	if r.Method == http.MethodGet && path == "/v1/dap" {
		user := auth.User
		if user == "" {
			user = "anonymous"
		}
		s.dap.HandleWebSocket(w, r, user)
		return
	}

	if r.Method != http.MethodPost || path != "/v1/run" {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "没有这个接口"}, nil)
		return
	}

	job, badMsg, _ := ParseAndValidateJob(body)
	if badMsg != "" {
		s.metrics.IncCounter("cd_runner_jobs_total", map[string]string{"status": "bad_request", "lang": "unknown"})
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": badMsg}, nil)
		return
	}

	user := auth.User
	if user == "" {
		user = "anonymous"
	}
	if limited := s.limits.Admit(user, time.Now()); limited != "" {
		s.metrics.IncCounter("cd_runner_jobs_total", map[string]string{"status": "rate_limited", "lang": job.Lang})
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": limited}, map[string]string{"Retry-After": "10"})
		return
	}
	defer s.limits.Done(user)

	t0 := time.Now()
	release, admitted, acquireErr := s.slots.Acquire(r.Context())
	if !admitted {
		s.metrics.IncCounter("cd_runner_jobs_total", map[string]string{"status": "queue_full", "lang": job.Lang})
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "云端运行的人太多了，稍后再试"}, map[string]string{"Retry-After": "15"})
		return
	}
	if acquireErr != nil {
		return
	}
	defer release()

	queueMs := time.Since(t0).Milliseconds()
	s.metrics.ObserveMs("cd_runner_queue_wait_ms", float64(queueMs), map[string]string{"lang": job.Lang})

	sbCases := make([]SandboxCase, len(job.Cases))
	for i, c := range job.Cases {
		if job.Mode == "acm" {
			sbCases[i] = SandboxCase{Stdin: c.Stdin}
		} else {
			sbCases[i] = SandboxCase{Input: c.Input}
		}
	}
	task := SandboxTask{
		Lang:   job.Lang,
		Mode:   job.Mode,
		Code:   job.Code,
		Sig:    job.Sig,
		Cases:  sbCases,
		Debug:  job.Debug,
		Limits: TaskLimits{CaseMs: s.cfg.CaseMs, TotalMs: s.cfg.TotalMs, Steps: 1000},
	}
	taskBytes, err := json.Marshal(task)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "运行器出错了"}, nil)
		return
	}

	res := s.driver.Run(r.Context(), taskBytes, time.Duration(s.cfg.JobMs)*time.Millisecond)
	totalMs := time.Since(t0).Milliseconds()
	if res.BootMeasured || res.BootMs > 0 {
		s.metrics.ObserveMs("cd_runner_fc_boot_ms", float64(res.BootMs), nil)
	}
	s.metrics.ObserveMs("cd_runner_job_duration_ms", float64(totalMs), map[string]string{"lang": job.Lang, "mode": job.Mode})

	resOK := false
	compileErr := false
	var compileMs, runMs any
	if res.OK && res.JSON != nil {
		resOK, _ = res.JSON["ok"].(bool)
		_, hasCE := res.JSON["compileError"]
		compileErr = hasCE && res.JSON["compileError"] != nil && res.JSON["compileError"] != ""
		compileMs = res.JSON["compileMs"]
		runMs = res.JSON["runMs"]
	}
	logEntry := map[string]any{
		"event":        "run",
		"node":         s.cfg.Node,
		"user":         user,
		"lang":         job.Lang,
		"mode":         job.Mode,
		"debug":        job.Debug,
		"cases":        len(job.Cases),
		"queueMs":      queueMs,
		"bootMs":       res.BootMs,
		"totalMs":      totalMs,
		"ok":           resOK,
		"compileError": compileErr,
	}
	if compileMs != nil {
		logEntry["compileMs"] = compileMs
	}
	if runMs != nil {
		logEntry["runMs"] = runMs
	}
	s.logFn(logEntry)

	if !res.OK && res.Busy {
		s.metrics.IncCounter("cd_runner_jobs_total", map[string]string{"status": "vm_busy", "lang": job.Lang})
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"error": res.Error}, map[string]string{"Retry-After": "5"})
		return
	}
	if !res.OK {
		s.metrics.IncCounter("cd_runner_jobs_total", map[string]string{"status": "driver_error", "lang": job.Lang})
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": res.Error}, nil)
		return
	}
	if !resOK {
		errStr, _ := res.JSON["error"].(string)
		if errStr == "" {
			errStr = "运行失败"
		}
		s.metrics.IncCounter("cd_runner_jobs_total", map[string]string{"status": "sandbox_rejected", "lang": job.Lang})
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": errStr}, nil)
		return
	}

	s.metrics.IncCounter("cd_runner_jobs_total", map[string]string{"status": "ok", "lang": job.Lang})
	out := make(map[string]any, len(res.JSON)+4)
	maps.Copy(out, res.JSON)
	out["node"] = s.cfg.Node
	out["queueMs"] = queueMs
	out["bootMs"] = res.BootMs
	out["totalMs"] = totalMs
	writeJSON(w, http.StatusOK, out, nil)
}

func readBoundedBody(w http.ResponseWriter, r *http.Request, max int64) ([]byte, bool) {
	if r.Body == nil {
		return nil, true
	}
	defer r.Body.Close()
	limited := http.MaxBytesReader(w, r.Body, max)
	data, err := io.ReadAll(limited)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return nil, false
		}
		return nil, false
	}
	return data, true
}

func writeJSON(w http.ResponseWriter, status int, payload any, extraHeaders map[string]string) {
	b, _ := json.Marshal(payload)
	h := w.Header()
	h.Set("Content-Type", "application/json; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("X-Content-Type-Options", "nosniff")
	for k, v := range extraHeaders {
		h.Set(k, v)
	}
	w.WriteHeader(status)
	_, _ = w.Write(b)
}
