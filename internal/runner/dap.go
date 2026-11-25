package runner

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/otel"
	"github.com/Hanwen-Jiang/coding-dance/internal/ws"
)

const maxDAPPayload = 4 << 20 // 4 MiB per DAP frame

// ReadDAPFrame reads a single Debug Adapter Protocol message framed with Content-Length: <N>\r\n\r\n.
func ReadDAPFrame(r *bufio.Reader) ([]byte, error) {
	contentLen := -1
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			break
		}
		if k, v, ok := strings.Cut(line, ":"); ok && strings.EqualFold(strings.TrimSpace(k), "Content-Length") {
			n, err := strconv.Atoi(strings.TrimSpace(v))
			if err != nil || n < 0 || n > maxDAPPayload {
				return nil, fmt.Errorf("invalid DAP Content-Length: %q", v)
			}
			contentLen = n
		}
	}
	if contentLen < 0 {
		return nil, errors.New("missing Content-Length in DAP header")
	}
	payload := make([]byte, contentLen)
	if _, err := io.ReadFull(r, payload); err != nil {
		return nil, err
	}
	return payload, nil
}

// WriteDAPFrame writes a JSON payload wrapped in standard DAP Content-Length headers.
func WriteDAPFrame(w io.Writer, payload []byte) error {
	hdr := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(payload))
	if _, err := io.WriteString(w, hdr); err != nil {
		return err
	}
	_, err := w.Write(payload)
	return err
}

// DAPInitRequest is sent as the first WebSocket frame to bootstrap an interactive debug session.
type DAPInitRequest struct {
	Type  string          `json:"type"` // "init"
	Lang  string          `json:"lang"` // "go" | "cpp" | "java"
	Mode  string          `json:"mode"` // "leetcode" | "acm"
	Code  string          `json:"code"`
	Sig   json.RawMessage `json:"sig,omitempty"`
	Stdin string          `json:"stdin,omitempty"`
}

// DAPAdapterSession represents a running stdio/socket DAP backend inside an isolated workspace/microVM.
type DAPAdapterSession interface {
	Reader() *bufio.Reader
	Writer() io.Writer
	ExecutablePath() string
	SourcePath() string
	Close() error
}

// DAPSpawner creates a language-specific DAP adapter process for an interactive session.
type DAPSpawner func(ctx context.Context, initReq DAPInitRequest) (DAPAdapterSession, error)

type DAPManager struct {
	IdleTimeout time.Duration
	MaxDuration time.Duration
	MaxSessions int
	Spawner     DAPSpawner
	Metrics     *otel.Registry
	LogFn       func(map[string]any)

	active atomic.Int64
	mu     sync.Mutex
	byUser map[string]string
}

func NewDAPManager(idle, maxDur time.Duration, maxSessions int, metrics *otel.Registry, logFn func(map[string]any)) *DAPManager {
	if idle <= 0 {
		idle = 5 * time.Minute
	}
	if maxDur <= 0 {
		maxDur = 30 * time.Minute
	}
	if maxSessions <= 0 {
		maxSessions = 8
	}
	m := &DAPManager{
		IdleTimeout: idle,
		MaxDuration: maxDur,
		MaxSessions: maxSessions,
		Spawner:     defaultLocalDAPSpawner,
		Metrics:     metrics,
		LogFn:       logFn,
		byUser:      make(map[string]string),
	}
	if metrics != nil {
		metrics.RegisterGaugeFunc("cd_runner_dap_sessions_active", func() float64 {
			return float64(m.active.Load())
		})
	}
	return m
}

func (m *DAPManager) ActiveCount() int64 {
	return m.active.Load()
}

func (m *DAPManager) HandleWebSocket(w http.ResponseWriter, r *http.Request, user string) {
	if int(m.active.Load()) >= m.MaxSessions {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "云端调试会话已满，请稍后再试"}, map[string]string{"Retry-After": "10"})
		return
	}
	m.mu.Lock()
	if _, busy := m.byUser[user]; busy {
		m.mu.Unlock()
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "你已有一个正在进行的云端调试会话"}, nil)
		return
	}
	sessionID := "dap-" + randomHex(8)
	m.byUser[user] = sessionID
	m.mu.Unlock()

	m.active.Add(1)
	if m.Metrics != nil {
		m.Metrics.IncCounter("cd_runner_dap_sessions_total", map[string]string{"status": "started"})
	}
	defer func() {
		m.active.Add(-1)
		m.mu.Lock()
		delete(m.byUser, user)
		m.mu.Unlock()
	}()

	conn, err := ws.Upgrade(w, r)
	if err != nil {
		return
	}
	defer conn.Close()

	sessionCtx, cancel := context.WithTimeout(r.Context(), m.MaxDuration)
	defer cancel()

	_ = conn.SetReadDeadline(time.Now().Add(30 * time.Second))
	_, initBytes, err := conn.ReadMessage()
	if err != nil {
		return
	}
	var initReq DAPInitRequest
	if err := json.Unmarshal(initBytes, &initReq); err != nil {
		_ = conn.WriteJSON(map[string]any{"type": "error", "error": "调试初始化消息不是合法的 JSON"})
		return
	}
	if !slices.Contains(DebugLangs, initReq.Lang) {
		_ = conn.WriteJSON(map[string]any{"type": "error", "error": "这门语言暂不支持云端交互式 DAP 调试"})
		return
	}
	if strings.TrimSpace(initReq.Code) == "" || len(initReq.Code) > 100000 {
		_ = conn.WriteJSON(map[string]any{"type": "error", "error": "调试代码为空或超过 100 KB"})
		return
	}

	adapter, err := m.Spawner(sessionCtx, initReq)
	if err != nil {
		_ = conn.WriteJSON(map[string]any{"type": "error", "error": err.Error()})
		if m.Metrics != nil {
			m.Metrics.IncCounter("cd_runner_dap_sessions_total", map[string]string{"status": "compile_or_spawn_error"})
		}
		return
	}
	defer adapter.Close()

	if m.LogFn != nil {
		m.LogFn(map[string]any{"event": "dap-start", "sessionId": sessionID, "user": user, "lang": initReq.Lang})
	}
	_ = conn.WriteJSON(map[string]any{
		"type":       "ready",
		"sessionId":  sessionID,
		"lang":       initReq.Lang,
		"program":    adapter.ExecutablePath(),
		"sourcePath": adapter.SourcePath(),
	})

	done := make(chan struct{})
	var closeOnce sync.Once
	stopAll := func() {
		closeOnce.Do(func() {
			cancel()
			_ = adapter.Close()
			_ = conn.Close()
			close(done)
		})
	}

	// Adapter stdout (DAP Content-Length frames) -> WebSocket UTF-8 JSON frames
	go func() {
		defer stopAll()
		for {
			payload, err := ReadDAPFrame(adapter.Reader())
			if err != nil {
				return
			}
			if err := conn.WriteText(payload); err != nil {
				return
			}
		}
	}()

	// WebSocket UTF-8 JSON frames -> Adapter stdin (DAP Content-Length frames)
	var writeMu sync.Mutex
	for {
		_ = conn.SetReadDeadline(time.Now().Add(m.IdleTimeout))
		_, msg, err := conn.ReadMessage()
		if err != nil {
			stopAll()
			break
		}
		var js map[string]any
		if json.Unmarshal(msg, &js) != nil {
			continue
		}
		writeMu.Lock()
		wErr := WriteDAPFrame(adapter.Writer(), msg)
		writeMu.Unlock()
		if wErr != nil {
			stopAll()
			break
		}
	}
	<-done
	if m.LogFn != nil {
		m.LogFn(map[string]any{"event": "dap-end", "sessionId": sessionID, "user": user, "lang": initReq.Lang})
	}
}

type localProcDAPSession struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	reader  *bufio.Reader
	workDir string
	exePath string
	srcPath string
}

func (s *localProcDAPSession) Reader() *bufio.Reader  { return s.reader }
func (s *localProcDAPSession) Writer() io.Writer      { return s.stdin }
func (s *localProcDAPSession) ExecutablePath() string { return s.exePath }
func (s *localProcDAPSession) SourcePath() string     { return s.srcPath }
func (s *localProcDAPSession) Close() error {
	_ = s.stdin.Close()
	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
		_ = s.cmd.Wait()
	}
	if s.workDir != "" {
		_ = os.RemoveAll(s.workDir)
	}
	return nil
}

// defaultLocalDAPSpawner compiles user code with debug symbols (-gcflags="all=-N -l" / -g -O0)
// and starts the native stdio DAP adapter (dlv dap / lldb-dap / gdb -i=dap).
func defaultLocalDAPSpawner(ctx context.Context, req DAPInitRequest) (DAPAdapterSession, error) {
	workDir, err := os.MkdirTemp("", "cd-dap-")
	if err != nil {
		return nil, err
	}
	cleanupOnErr := func(e error) (DAPAdapterSession, error) {
		_ = os.RemoveAll(workDir)
		return nil, e
	}

	var srcPath, exePath string
	var dapCmd *exec.Cmd

	switch req.Lang {
	case "go":
		srcPath = filepath.Join(workDir, "main.go")
		exePath = filepath.Join(workDir, "prog")
		if err := os.WriteFile(srcPath, []byte(req.Code), 0o600); err != nil {
			return cleanupOnErr(err)
		}
		if err := os.WriteFile(filepath.Join(workDir, "go.mod"), []byte("module dapjob\ngo 1.22\n"), 0o600); err != nil {
			return cleanupOnErr(err)
		}
		buildOut, err := exec.CommandContext(ctx, "go", "build", `-gcflags=all=-N -l`, "-o", exePath, srcPath).CombinedOutput()
		if err != nil {
			return cleanupOnErr(fmt.Errorf("编译出错：\n%s", strings.TrimSpace(string(buildOut))))
		}
		dapCmd = exec.CommandContext(ctx, "dlv", "dap", "--log=false")
	case "cpp":
		srcPath = filepath.Join(workDir, "main.cpp")
		exePath = filepath.Join(workDir, "prog")
		if err := os.WriteFile(srcPath, []byte(req.Code), 0o600); err != nil {
			return cleanupOnErr(err)
		}
		compiler := "g++"
		if _, err := exec.LookPath("g++"); err != nil {
			compiler = "clang++"
		}
		buildOut, err := exec.CommandContext(ctx, compiler, "-std=c++20", "-g", "-O0", "-o", exePath, srcPath).CombinedOutput()
		if err != nil {
			return cleanupOnErr(fmt.Errorf("编译出错：\n%s", strings.TrimSpace(string(buildOut))))
		}
		if _, err := exec.LookPath("lldb-dap"); err == nil {
			dapCmd = exec.CommandContext(ctx, "lldb-dap")
		} else {
			dapCmd = exec.CommandContext(ctx, "gdb", "-q", "-nx", "-i=dap")
		}
	case "java":
		srcPath = filepath.Join(workDir, "Main.java")
		exePath = workDir
		if err := os.WriteFile(srcPath, []byte(req.Code), 0o600); err != nil {
			return cleanupOnErr(err)
		}
		buildOut, err := exec.CommandContext(ctx, "javac", "-encoding", "UTF-8", "-g", "-d", workDir, srcPath).CombinedOutput()
		if err != nil {
			return cleanupOnErr(fmt.Errorf("编译出错：\n%s", strings.TrimSpace(string(buildOut))))
		}
		javaDAP := os.Getenv("RUNNER_JAVA_DAP_BIN")
		if javaDAP == "" {
			javaDAP = "java-dap"
		}
		dapCmd = exec.CommandContext(ctx, javaDAP)
	default:
		return cleanupOnErr(errors.New("不支持的调试语言"))
	}

	dapCmd.Dir = workDir
	stdin, err := dapCmd.StdinPipe()
	if err != nil {
		return cleanupOnErr(err)
	}
	stdout, err := dapCmd.StdoutPipe()
	if err != nil {
		return cleanupOnErr(err)
	}
	if err := dapCmd.Start(); err != nil {
		return cleanupOnErr(fmt.Errorf("启动调试器失败：%w", err))
	}
	return &localProcDAPSession{
		cmd:     dapCmd,
		stdin:   stdin,
		reader:  bufio.NewReader(stdout),
		workDir: workDir,
		exePath: exePath,
		srcPath: srcPath,
	}, nil
}
