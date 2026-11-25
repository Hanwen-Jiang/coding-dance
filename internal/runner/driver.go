package runner

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const SandboxInImage = "/opt/lc/tools/runner/sandbox/sandbox.js"

type RunOutcome struct {
	OK     bool
	Busy   bool
	BootMs int64
	Error  string
	JSON   map[string]any
}

type Driver interface {
	Init(ctx context.Context) error
	Run(ctx context.Context, input []byte, timeout time.Duration) RunOutcome
	Status() map[string]any
	Close() error
}

func randomHex(nBytes int) string {
	b := make([]byte, nBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func randomUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func pipeJobCommand(parentCtx context.Context, name string, args []string, env []string, input []byte, timeout time.Duration) RunOutcome {
	ctx, cancel := context.WithTimeout(parentCtx, timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	if len(env) > 0 {
		cmd.Env = env
	}
	cmd.Stdin = bytes.NewReader(input)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &limitedBuffer{buf: &stdout, max: 32 << 20}
	cmd.Stderr = &tailBuffer{max: 4000, buf: &stderr}

	err := cmd.Run()
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return RunOutcome{OK: false, Error: "这次运行超过了总时间限制，被停下了"}
	}
	if err != nil && stdout.Len() == 0 {
		var execErr *exec.Error
		if errors.As(err, &execErr) {
			return RunOutcome{OK: false, Error: "启动沙箱失败：" + execErr.Error()}
		}
	}
	var parsed map[string]any
	if err := json.Unmarshal(stdout.Bytes(), &parsed); err != nil {
		tail := lastLines(stderr.String(), 3)
		msg := "沙箱没有返回结果"
		if tail != "" {
			msg += "：" + tail
		}
		return RunOutcome{OK: false, Error: msg}
	}
	return RunOutcome{OK: true, JSON: parsed}
}

type limitedBuffer struct {
	buf *bytes.Buffer
	max int
}

func (l *limitedBuffer) Write(p []byte) (int, error) {
	if l.buf.Len()+len(p) > l.max {
		rem := l.max - l.buf.Len()
		if rem > 0 {
			l.buf.Write(p[:rem])
		}
		return len(p), nil
	}
	return l.buf.Write(p)
}

type tailBuffer struct {
	buf *bytes.Buffer
	max int
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	t.buf.Write(p)
	if t.buf.Len() > t.max*2 {
		b := t.buf.Bytes()
		keep := b[len(b)-t.max:]
		t.buf.Reset()
		t.buf.Write(keep)
	}
	return len(p), nil
}

func lastLines(s string, n int) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	lines := strings.Split(s, "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, " | ")
}

type FirecrackerConfig struct {
	URL         string
	Token       string
	TokenFile   string
	Owner       string
	Runtime     string
	CPUMillis   int
	MemoryMB    int
	SandboxArgv []string
	LogFn       func(map[string]any)
}

// FirecrackerDriver calls agent-runtime's fc-manager HTTP/Unix API directly.
// Each execution runs in a fresh, networkless Firecracker microVM via Rust sandbox-agent.
type FirecrackerDriver struct {
	FirecrackerConfig
	client *http.Client
	base   string
	live   atomic.Int64
}

func NewFirecrackerDriver(cfg FirecrackerConfig) *FirecrackerDriver {
	if cfg.Owner == "" {
		cfg.Owner = "lc-hot100"
	}
	if cfg.Runtime == "" {
		cfg.Runtime = "lc-runner"
	}
	if cfg.CPUMillis <= 0 {
		cfg.CPUMillis = 1000
	}
	if cfg.MemoryMB <= 0 {
		cfg.MemoryMB = 1024
	}
	if len(cfg.SandboxArgv) == 0 {
		cfg.SandboxArgv = []string{"node", SandboxInImage}
	}
	rawURL := strings.TrimRight(cfg.URL, "/")
	if rawURL == "" {
		rawURL = "http://127.0.0.1:8097"
	}
	transport := &http.Transport{
		MaxIdleConnsPerHost: 32,
		IdleConnTimeout:     60 * time.Second,
	}
	base := rawURL
	if strings.HasPrefix(rawURL, "unix://") {
		sockPath := strings.TrimPrefix(rawURL, "unix://")
		base = "http://fc-manager"
		transport.DialContext = func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", sockPath)
		}
	}
	return &FirecrackerDriver{
		FirecrackerConfig: cfg,
		client:            &http.Client{Transport: transport},
		base:              base,
	}
}

func (d *FirecrackerDriver) resolveToken() (string, error) {
	if d.Token != "" {
		return d.Token, nil
	}
	if d.TokenFile == "" {
		return "", errors.New("未配置 RUNNER_FC_TOKEN 或 RUNNER_FC_TOKEN_FILE")
	}
	raw, err := os.ReadFile(d.TokenFile)
	if err != nil {
		return "", err
	}
	var store struct {
		Scopes map[string]struct {
			Secrets map[string]string `json:"secrets"`
		} `json:"scopes"`
	}
	if err := json.Unmarshal(raw, &store); err != nil {
		return "", err
	}
	tok := store.Scopes["_platform"].Secrets["sandbox/fc-manager-token"]
	if tok == "" {
		return "", fmt.Errorf("%s 里没有 _platform 作用域的 sandbox/fc-manager-token", d.TokenFile)
	}
	return tok, nil
}

func (d *FirecrackerDriver) call(ctx context.Context, method, path string, body any, timeout time.Duration) (int, map[string]any, string, error) {
	tok, err := d.resolveToken()
	if err != nil {
		return 0, nil, "", err
	}
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, "", err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(reqCtx, method, d.base+path, reader)
	if err != nil {
		return 0, nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("X-Sandbox-Owner", d.Owner)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return 0, nil, "", err
	}
	defer resp.Body.Close()
	rawBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	text := string(rawBytes)
	var parsed map[string]any
	if len(rawBytes) > 0 {
		_ = json.Unmarshal(rawBytes, &parsed)
	}
	return resp.StatusCode, parsed, text, nil
}

func (d *FirecrackerDriver) Init(ctx context.Context) error {
	reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, d.base+"/healthz", nil)
	if err != nil {
		return err
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("连不上 fc-manager（%s）：%w", d.base, err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("fc-manager 的 /healthz 返回 %d", resp.StatusCode)
	}
	_, err = d.resolveToken()
	return err
}

func (d *FirecrackerDriver) Run(ctx context.Context, input []byte, timeout time.Duration) RunOutcome {
	t0 := time.Now()
	status, created, text, err := d.call(ctx, http.MethodPost, "/v1/envs", map[string]any{
		"runtime":    d.Runtime,
		"cpu_millis": d.CPUMillis,
		"memory_mb":  d.MemoryMB,
		"labels":     map[string]string{"app": "lc-hot100"},
	}, 30*time.Second)
	if err != nil {
		return RunOutcome{OK: false, Error: "连不上 fc-manager：" + err.Error()}
	}
	if status == http.StatusServiceUnavailable {
		return RunOutcome{OK: false, Busy: true, Error: "这台机器上的 microVM 满了"}
	}
	envID, _ := created["env_id"].(string)
	if status != http.StatusCreated || envID == "" {
		msg, _ := created["message"].(string)
		if msg == "" {
			msg = truncateStr(text, 200)
		}
		return RunOutcome{OK: false, Error: fmt.Sprintf("建 microVM 失败（%d）：%s", status, msg)}
	}

	d.live.Add(1)
	bootMs := time.Since(t0).Milliseconds()
	defer func() {
		d.live.Add(-1)
		go func(id string) {
			delStatus, _, _, delErr := d.call(context.Background(), http.MethodDelete, "/v1/envs/"+id, nil, 30*time.Second)
			if delErr != nil && d.LogFn != nil {
				d.LogFn(map[string]any{"event": "fc-delete", "env": id, "error": delErr.Error()})
			} else if delStatus != http.StatusNoContent && d.LogFn != nil {
				d.LogFn(map[string]any{"event": "fc-delete", "env": id, "status": delStatus})
			}
		}(envID)
	}()

	execStatus, execRes, execText, err := d.call(ctx, http.MethodPost, fmt.Sprintf("/v1/envs/%s/agent/v1/exec", envID), map[string]any{
		"argv":                 d.SandboxArgv,
		"stdin":                base64.StdEncoding.EncodeToString(input),
		"timeout_ms":           timeout.Milliseconds(),
		"env":                  map[string]string{"RUNNER_WORK": "/workspace", "RUNNER_PREPARED": "/opt/lc/prepared", "PYTHON": "python3", "GOTOOLCHAIN": "local", "CGO_ENABLED": "0"},
		"exec_id":              randomUUID(),
		"offload_inline_bytes": 0,
	}, timeout+15*time.Second)
	if err != nil {
		return RunOutcome{OK: false, BootMs: bootMs, Error: "microVM 里执行出错：" + err.Error()}
	}
	if execStatus != http.StatusOK || execRes == nil {
		msg, _ := execRes["message"].(string)
		if msg == "" {
			msg = truncateStr(execText, 200)
		}
		return RunOutcome{OK: false, BootMs: bootMs, Error: fmt.Sprintf("microVM 里执行失败（%d）：%s", execStatus, msg)}
	}
	if timedOut, _ := execRes["timed_out"].(bool); timedOut {
		return RunOutcome{OK: false, BootMs: bootMs, Error: "这次运行超过了总时间限制，被停下了"}
	}
	stdoutB64, _ := execRes["stdout"].(string)
	stdoutBytes, _ := base64.StdEncoding.DecodeString(stdoutB64)
	var outJSON map[string]any
	if err := json.Unmarshal(stdoutBytes, &outJSON); err != nil {
		stderrB64, _ := execRes["stderr"].(string)
		stderrBytes, _ := base64.StdEncoding.DecodeString(stderrB64)
		tail := lastLines(string(stderrBytes), 3)
		exitCode := execRes["exit_code"]
		msg := fmt.Sprintf("沙箱没有返回结果（退出码 %v）", exitCode)
		if tail != "" {
			msg += "：" + tail
		}
		return RunOutcome{OK: false, BootMs: bootMs, Error: msg}
	}
	return RunOutcome{OK: true, BootMs: bootMs, JSON: outJSON}
}

func (d *FirecrackerDriver) Status() map[string]any {
	return map[string]any{
		"driver":  "firecracker",
		"runtime": d.Runtime,
		"live":    d.live.Load(),
	}
}

func (d *FirecrackerDriver) Close() error { return nil }

// DockerPool maintains a pre-warmed pool of locked-down Docker containers for CI and dev.
type DockerPool struct {
	Image   string
	Size    int
	Runtime string
	Memory  string
	CPUs    string
	PIDs    int
	LogFn   func(map[string]any)

	mu       sync.Mutex
	ready    []string
	starting int
	closed   bool
}

func DockerRunArgs(image, name, runtime, memory, cpus string, pids int) []string {
	if memory == "" {
		memory = "1g"
	}
	if cpus == "" {
		cpus = "1"
	}
	if pids <= 0 {
		pids = 256
	}
	args := []string{
		"run", "-d", "--name", name, "--label", "lc-runner=1",
		"--network", "none", "--read-only",
		"--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=128m,mode=1777",
		"--tmpfs", "/work:rw,exec,nosuid,nodev,size=256m,mode=1777",
		"--memory", memory, "--memory-swap", memory, "--cpus", cpus, "--pids-limit", fmt.Sprintf("%d", pids),
		"--ulimit", "nofile=512:512", "--ulimit", "fsize=134217728:134217728", "--ulimit", "core=0",
		"--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "10001:10001",
	}
	if runtime != "" {
		args = append(args, "--runtime", runtime)
	}
	args = append(args, image, "sleep", "infinity")
	return args
}

func (p *DockerPool) Init(ctx context.Context) error {
	if p.Image == "" {
		p.Image = "lc-runner:latest"
	}
	if err := exec.CommandContext(ctx, "docker", "image", "inspect", p.Image).Run(); err != nil {
		return fmt.Errorf("没有镜像 %s：先构建镜像（见 tools/runner/README.md）", p.Image)
	}
	p.cleanup()
	p.fill()
	return nil
}

func (p *DockerPool) cleanup() {
	out, err := exec.Command("docker", "ps", "-aq", "--filter", "label=lc-runner=1").Output()
	if err != nil {
		return
	}
	ids := strings.Fields(string(out))
	if len(ids) > 0 {
		args := append([]string{"rm", "-f"}, ids...)
		_ = exec.Command("docker", args...).Run()
	}
}

func (p *DockerPool) createContainer(ctx context.Context) (string, error) {
	name := "lcr-" + randomHex(6)
	args := DockerRunArgs(p.Image, name, p.Runtime, p.Memory, p.CPUs, p.PIDs)
	out, err := exec.CommandContext(ctx, "docker", args...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s (%w)", strings.TrimSpace(string(out)), err)
	}
	return name, nil
}

func (p *DockerPool) fill() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for !p.closed && len(p.ready)+p.starting < p.Size {
		p.starting++
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()
			name, err := p.createContainer(ctx)
			p.mu.Lock()
			p.starting--
			if err != nil {
				p.mu.Unlock()
				if p.LogFn != nil {
					p.LogFn(map[string]any{"event": "pool-error", "error": err.Error()})
				}
				return
			}
			if p.closed {
				p.mu.Unlock()
				_ = exec.Command("docker", "rm", "-f", name).Run()
				return
			}
			p.ready = append(p.ready, name)
			p.mu.Unlock()
		}()
	}
}

func (p *DockerPool) Run(ctx context.Context, input []byte, timeout time.Duration) RunOutcome {
	p.mu.Lock()
	var name string
	if len(p.ready) > 0 {
		name = p.ready[0]
		p.ready = p.ready[1:]
	}
	p.mu.Unlock()
	p.fill()

	if name == "" {
		var err error
		name, err = p.createContainer(ctx)
		if err != nil {
			return RunOutcome{OK: false, Error: "启动容器失败：" + err.Error()}
		}
	}
	defer func() {
		go func(n string) { _ = exec.Command("docker", "rm", "-f", n).Run() }(name)
	}()
	return pipeJobCommand(ctx, "docker", []string{"exec", "-i", name, "node", SandboxInImage}, nil, input, timeout)
}

func (p *DockerPool) Status() map[string]any {
	p.mu.Lock()
	defer p.mu.Unlock()
	rt := p.Runtime
	if rt == "" {
		rt = "runc"
	}
	return map[string]any{
		"driver":   "docker",
		"ready":    len(p.ready),
		"starting": p.starting,
		"runtime":  rt,
	}
}

func (p *DockerPool) Close() error {
	p.mu.Lock()
	p.closed = true
	p.mu.Unlock()
	p.cleanup()
	return nil
}

// LocalDriver runs the sandbox script directly on the local machine (development & unit tests only).
type LocalDriver struct {
	SandboxPath string
	NodeBin     string
}

func (l *LocalDriver) Init(_ context.Context) error {
	if l.NodeBin == "" {
		l.NodeBin = "node"
	}
	if l.SandboxPath == "" {
		l.SandboxPath = resolveLocalSandboxPath()
	}
	return nil
}

func resolveLocalSandboxPath() string {
	if v := os.Getenv("RUNNER_LOCAL_SANDBOX"); v != "" {
		return v
	}
	candidates := []string{
		"tools/runner/sandbox/sandbox.js",
		"../../tools/runner/sandbox/sandbox.js",
		"../sandbox/sandbox.js",
	}
	for _, c := range candidates {
		if abs, err := filepath.Abs(c); err == nil {
			if _, statErr := os.Stat(abs); statErr == nil {
				return abs
			}
		}
	}
	return "tools/runner/sandbox/sandbox.js"
}

func (l *LocalDriver) Run(ctx context.Context, input []byte, timeout time.Duration) RunOutcome {
	nodeBin := l.NodeBin
	if nodeBin == "" {
		nodeBin = "node"
	}
	sbPath := l.SandboxPath
	if sbPath == "" {
		sbPath = resolveLocalSandboxPath()
	}
	workDir, err := os.MkdirTemp("", "lc-runner-")
	if err != nil {
		return RunOutcome{OK: false, Error: "创建工作目录失败：" + err.Error()}
	}
	defer os.RemoveAll(workDir)
	env := append(os.Environ(), "RUNNER_WORK="+workDir)
	return pipeJobCommand(ctx, nodeBin, []string{sbPath}, env, input, timeout)
}

func (l *LocalDriver) Status() map[string]any {
	return map[string]any{"driver": "local", "ready": 0, "starting": 0}
}

func (l *LocalDriver) Close() error { return nil }

func truncateStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
