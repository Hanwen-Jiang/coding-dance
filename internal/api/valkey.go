package api

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"
)

// KVStore abstracts Valkey/Redis atomic operations with an in-memory fallback for local dev & tests.
type KVStore interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string, ttl time.Duration) error
	IncrWithTTL(ctx context.Context, key string, ttl time.Duration) (int64, error)
	DecrFloorZero(ctx context.Context, key string) (int64, error)
}

type memEntry struct {
	val string
	exp time.Time
}

type MemoryKV struct {
	mu   sync.Mutex
	data map[string]memEntry
}

func NewMemoryKV() *MemoryKV {
	return &MemoryKV{data: make(map[string]memEntry)}
}

func (m *MemoryKV) Get(_ context.Context, key string) (string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.data[key]
	if !ok {
		return "", false, nil
	}
	if !e.exp.IsZero() && time.Now().After(e.exp) {
		delete(m.data, key)
		return "", false, nil
	}
	return e.val, true, nil
}

func (m *MemoryKV) Set(_ context.Context, key, value string, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var exp time.Time
	if ttl > 0 {
		exp = time.Now().Add(ttl)
	}
	m.data[key] = memEntry{val: value, exp: exp}
	return nil
}

func (m *MemoryKV) IncrWithTTL(_ context.Context, key string, ttl time.Duration) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	e, ok := m.data[key]
	var cur int64
	var exp time.Time
	if ok && (e.exp.IsZero() || now.Before(e.exp)) {
		cur, _ = strconv.ParseInt(e.val, 10, 64)
		exp = e.exp
	} else if ttl > 0 {
		exp = now.Add(ttl)
	}
	cur++
	m.data[key] = memEntry{val: strconv.FormatInt(cur, 10), exp: exp}
	return cur, nil
}

func (m *MemoryKV) DecrFloorZero(_ context.Context, key string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.data[key]
	if !ok {
		return 0, nil
	}
	cur, _ := strconv.ParseInt(e.val, 10, 64)
	if cur <= 1 {
		delete(m.data, key)
		return 0, nil
	}
	cur--
	e.val = strconv.FormatInt(cur, 10)
	m.data[key] = e
	return cur, nil
}

// ValkeyClient implements KVStore over standard RESP2 TCP connections.
type ValkeyClient struct {
	Addr     string
	Password string
	Timeout  time.Duration
}

func (v *ValkeyClient) execRESP(ctx context.Context, args ...string) (any, error) {
	timeout := v.Timeout
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	d := net.Dialer{Timeout: timeout}
	conn, err := d.DialContext(ctx, "tcp", v.Addr)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))
	br := bufio.NewReader(conn)

	if v.Password != "" {
		if err := writeRESPArray(conn, []string{"AUTH", v.Password}); err != nil {
			return nil, err
		}
		if _, err := readRESPValue(br); err != nil {
			return nil, err
		}
	}
	if err := writeRESPArray(conn, args); err != nil {
		return nil, err
	}
	return readRESPValue(br)
}

func writeRESPArray(w io.Writer, args []string) error {
	var b strings.Builder
	fmt.Fprintf(&b, "*%d\r\n", len(args))
	for _, a := range args {
		fmt.Fprintf(&b, "$%d\r\n%s\r\n", len(a), a)
	}
	_, err := io.WriteString(w, b.String())
	return err
}

func readRESPValue(r *bufio.Reader) (any, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}
	line = strings.TrimRight(line, "\r\n")
	if line == "" {
		return nil, errors.New("empty RESP reply")
	}
	switch line[0] {
	case '+':
		return line[1:], nil
	case '-':
		return nil, errors.New(line[1:])
	case ':':
		return strconv.ParseInt(line[1:], 10, 64)
	case '$':
		n, err := strconv.Atoi(line[1:])
		if err != nil {
			return nil, err
		}
		if n < 0 {
			return nil, nil
		}
		buf := make([]byte, n+2)
		if _, err := io.ReadFull(r, buf); err != nil {
			return nil, err
		}
		return string(buf[:n]), nil
	default:
		return nil, fmt.Errorf("unsupported RESP prefix %q", line[0])
	}
}

func (v *ValkeyClient) Get(ctx context.Context, key string) (string, bool, error) {
	res, err := v.execRESP(ctx, "GET", key)
	if err != nil || res == nil {
		return "", false, err
	}
	s, ok := res.(string)
	return s, ok, nil
}

func (v *ValkeyClient) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	sec := int(math.Max(1, ttl.Seconds()))
	_, err := v.execRESP(ctx, "SET", key, value, "EX", strconv.Itoa(sec))
	return err
}

func (v *ValkeyClient) IncrWithTTL(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	res, err := v.execRESP(ctx, "INCR", key)
	if err != nil {
		return 0, err
	}
	n, _ := res.(int64)
	if n == 1 && ttl > 0 {
		sec := int(math.Max(1, ttl.Seconds()))
		_, _ = v.execRESP(ctx, "EXPIRE", key, strconv.Itoa(sec))
	}
	return n, nil
}

func (v *ValkeyClient) DecrFloorZero(ctx context.Context, key string) (int64, error) {
	res, err := v.execRESP(ctx, "DECR", key)
	if err != nil {
		return 0, err
	}
	n, _ := res.(int64)
	if n < 0 {
		_, _ = v.execRESP(ctx, "SET", key, "0", "EX", "60")
		return 0, nil
	}
	return n, nil
}

// —— Cloud Daily Quota (100% compatible with site/functions/_lib/quota.ts) ——

type QuotaConfig struct {
	FreeLimit      int
	ProLimit       int
	MinAccountDays int
	FreePaused     bool
}

type QuotaProfile struct {
	Tier      string `json:"tier"` // "free" | "pro"
	Founder   bool   `json:"founder"`
	CreatedAt string `json:"createdAt,omitempty"`
}

type CloudQuota struct {
	Tier          string `json:"tier"`
	Founder       bool   `json:"founder"`
	Limit         int    `json:"limit"`
	Used          int    `json:"used"`
	Remaining     int    `json:"remaining"`
	Day           string `json:"day"`
	ResetAt       string `json:"resetAt"`
	BlockedReason string `json:"blockedReason,omitempty"`
}

type QuotaManager struct {
	KV  KVStore
	Cfg QuotaConfig
}

func BeijingDay(now time.Time) string {
	return now.In(time.FixedZone("CST", 8*3600)).Format("2006-01-02")
}

func NextBeijingMidnightISO(now time.Time) string {
	bj := now.In(time.FixedZone("CST", 8*3600)).Add(24 * time.Hour)
	return bj.Format("2006-01-02") + "T00:00:00+08:00"
}

func quotaDayKey(day, login string) string {
	return "quota:day:" + day + ":" + strings.ToLower(login)
}

func (qm *QuotaManager) buildQuota(p QuotaProfile, used int, now time.Time) CloudQuota {
	freeLim := qm.Cfg.FreeLimit
	if freeLim <= 0 {
		freeLim = 30
	}
	proLim := qm.Cfg.ProLimit
	if proLim <= 0 {
		proLim = 2000
	}
	limit := freeLim
	if p.Tier == "pro" {
		limit = proLim
	}
	rem := limit - used
	if rem < 0 {
		rem = 0
	}
	var blocked string
	if p.Tier == "free" && qm.Cfg.FreePaused {
		blocked = "free_paused"
	} else if p.Tier == "free" && !p.Founder && qm.Cfg.MinAccountDays > 0 && p.CreatedAt != "" {
		if createdTime, err := time.Parse(time.RFC3339, p.CreatedAt); err == nil {
			if now.Sub(createdTime) < time.Duration(qm.Cfg.MinAccountDays)*24*time.Hour {
				blocked = "account_too_new"
			}
		}
	}
	if blocked == "" && used >= limit {
		blocked = "quota_exceeded"
	}
	return CloudQuota{
		Tier:          p.Tier,
		Founder:       p.Founder,
		Limit:         limit,
		Used:          used,
		Remaining:     rem,
		Day:           BeijingDay(now),
		ResetAt:       NextBeijingMidnightISO(now),
		BlockedReason: blocked,
	}
}

func (qm *QuotaManager) Status(ctx context.Context, login string, p QuotaProfile, now time.Time) CloudQuota {
	day := BeijingDay(now)
	raw, ok, _ := qm.KV.Get(ctx, quotaDayKey(day, login))
	used := 0
	if ok {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			used = n
		}
	}
	return qm.buildQuota(p, used, now)
}

func (qm *QuotaManager) Consume(ctx context.Context, login string, p QuotaProfile, now time.Time) (ok bool, httpStatus int, code, errMsg string, q CloudQuota) {
	cur := qm.Status(ctx, login, p, now)
	switch cur.BlockedReason {
	case "free_paused":
		return false, 503, "free_paused", "免费云端运行因全站预算限制已暂时关闭，Python / JavaScript / TypeScript 可先切换回浏览器运行。", cur
	case "account_too_new":
		return false, 403, "account_too_new", fmt.Sprintf("为防止滥用，免费云端运行要求 GitHub 账号注册满 %d 天；Python / JavaScript / TypeScript 可直接免费在浏览器里运行。", qm.Cfg.MinAccountDays), cur
	case "quota_exceeded":
		return false, 429, "quota_exceeded", fmt.Sprintf("今日云端运行额度已用完（%d/%d 次），北京时间 0 点自动重置；Python / JavaScript / TypeScript 可改回浏览器运行。", cur.Used, cur.Limit), cur
	}
	nextUsed, err := qm.KV.IncrWithTTL(ctx, quotaDayKey(cur.Day, login), 48*time.Hour)
	if err != nil {
		nextUsed = int64(cur.Used + 1)
	}
	return true, 200, "", "", qm.buildQuota(p, int(nextUsed), now)
}

func (qm *QuotaManager) Refund(ctx context.Context, login, day string) {
	_, _ = qm.KV.DecrFloorZero(ctx, quotaDayKey(day, login))
}
