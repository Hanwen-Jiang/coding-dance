package runner

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
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
	Cases []JobCase       `json:"cases,omitempty"`
}

// DAPInitMeta is returned by the guest sandbox after compiling the debug target.
type DAPInitMeta struct {
	OK           bool   `json:"ok"`
	Lang         string `json:"lang"`
	Mode         string `json:"mode"`
	UserFile     string `json:"userFile"`
	Lines        int    `json:"lines"`
	CompileError string `json:"compileError,omitempty"`
	Error        string `json:"error,omitempty"`
}

type DAPCompileError struct {
	Message string
}

func (e *DAPCompileError) Error() string { return e.Message }

// DAPAdapterSession represents a running DAP backend inside an isolated Firecracker microVM or Docker container.
type DAPAdapterSession interface {
	Reader() *bufio.Reader
	Writer() io.Writer
	Meta() DAPInitMeta
	Close() error
}

// DAPSpawner creates an isolated DAP adapter session for an interactive request.
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

func NewDAPManager(driver Driver, idle, maxDur time.Duration, maxSessions int, metrics *otel.Registry, logFn func(map[string]any)) *DAPManager {
	if idle <= 0 {
		idle = 5 * time.Minute
	}
	if maxDur <= 0 {
		maxDur = 30 * time.Minute
	}
	if maxSessions <= 0 {
		maxSessions = 8
	}
	var spawner DAPSpawner
	if driver != nil {
		spawner = driver.StartDAP
	}
	m := &DAPManager{
		IdleTimeout: idle,
		MaxDuration: maxDur,
		MaxSessions: maxSessions,
		Spawner:     spawner,
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
	if initReq.Mode == "" {
		initReq.Mode = "acm"
	}
	if initReq.Mode != "leetcode" && initReq.Mode != "acm" {
		_ = conn.WriteJSON(map[string]any{"type": "error", "error": "模式只能是 leetcode 或 acm"})
		return
	}
	if initReq.Mode == "leetcode" && len(initReq.Sig) == 0 {
		_ = conn.WriteJSON(map[string]any{"type": "error", "error": "力扣模式要有函数签名"})
		return
	}
	if strings.TrimSpace(initReq.Code) == "" || len(initReq.Code) > 100000 {
		_ = conn.WriteJSON(map[string]any{"type": "error", "error": "调试代码为空或超过 100 KB"})
		return
	}
	if m.Spawner == nil {
		_ = conn.WriteJSON(map[string]any{"type": "error", "error": "运行器未配置调试驱动"})
		return
	}

	adapter, err := m.Spawner(sessionCtx, initReq)
	if err != nil {
		var ce *DAPCompileError
		if errors.As(err, &ce) {
			_ = conn.WriteJSON(map[string]any{"type": "compile_error", "compileError": ce.Message, "error": "编译出错：\n" + ce.Message})
			if m.Metrics != nil {
				m.Metrics.IncCounter("cd_runner_dap_sessions_total", map[string]string{"status": "compile_error"})
			}
			return
		}
		statusTag := "spawn_error"
		if errors.Is(err, ErrDAPCapacityBusy) {
			statusTag = "vm_busy"
		}
		_ = conn.WriteJSON(map[string]any{"type": "error", "busy": errors.Is(err, ErrDAPCapacityBusy), "error": err.Error()})
		if m.Metrics != nil {
			m.Metrics.IncCounter("cd_runner_dap_sessions_total", map[string]string{"status": statusTag})
		}
		return
	}
	defer adapter.Close()

	meta := adapter.Meta()
	if m.LogFn != nil {
		m.LogFn(map[string]any{"event": "dap-start", "sessionId": sessionID, "user": user, "lang": initReq.Lang, "mode": initReq.Mode})
	}
	_ = conn.WriteJSON(map[string]any{
		"type":       "ready",
		"sessionId":  sessionID,
		"lang":       initReq.Lang,
		"mode":       initReq.Mode,
		"sourceName": meta.UserFile,
		"lines":      meta.Lines,
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

	// Sandbox DAP stdout (Content-Length frames) -> Browser WebSocket JSON text frames
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

	// Browser WebSocket JSON text frames -> Sandbox DAP stdin (Content-Length frames)
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
