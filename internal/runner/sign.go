package runner

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const MaxSkewSec = 120

var (
	NodeIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)
	noncePattern  = regexp.MustCompile(`^[\w-]{16,64}$`)
	hex64Pattern  = regexp.MustCompile(`^[0-9a-f]{64}$`)
	userPattern   = regexp.MustCompile(`^[\w.-]{0,39}$`)
)

// SignParts matches tools/runner/lib/sign.mjs and site/functions/_lib/runner.ts.
type SignParts struct {
	Method   string
	Path     string
	Time     int64
	Nonce    string
	User     string
	Node     string
	BodyHash string
}

func SHA256Hex(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func Canonical(p SignParts) string {
	return strings.Join([]string{
		strings.ToUpper(p.Method),
		p.Path,
		strconv.FormatInt(p.Time, 10),
		p.Nonce,
		p.User,
		p.Node,
		p.BodyHash,
	}, "\n")
}

func Sign(secret string, p SignParts) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(Canonical(p)))
	return hex.EncodeToString(mac.Sum(nil))
}

func SignedHeaders(secret, method, path, node, user string, body []byte, now time.Time) map[string]string {
	var raw [12]byte
	_, _ = rand.Read(raw[:])
	nonce := hex.EncodeToString(raw[:])
	ts := now.Unix()
	sig := Sign(secret, SignParts{
		Method:   method,
		Path:     path,
		Time:     ts,
		Nonce:    nonce,
		User:     user,
		Node:     node,
		BodyHash: SHA256Hex(body),
	})
	return map[string]string{
		"x-runner-time":      strconv.FormatInt(ts, 10),
		"x-runner-nonce":     nonce,
		"x-runner-user":      user,
		"x-runner-node":      node,
		"x-runner-signature": sig,
	}
}

type NonceCache struct {
	ttl  time.Duration
	mu   sync.Mutex
	seen map[string]time.Time
}

func NewNonceCache(ttl time.Duration) *NonceCache {
	if ttl <= 0 {
		ttl = time.Duration(MaxSkewSec*2) * time.Second
	}
	return &NonceCache{
		ttl:  ttl,
		seen: make(map[string]time.Time),
	}
}

// CheckAndAdd atomically verifies that nonce has not been seen (or has expired) and records it.
func (c *NonceCache) CheckAndAdd(nonce string, now time.Time) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if exp, exists := c.seen[nonce]; exists && now.Before(exp) {
		return false
	}
	c.seen[nonce] = now.Add(c.ttl)
	if len(c.seen) > 5000 {
		for k, exp := range c.seen {
			if now.After(exp) {
				delete(c.seen, k)
			}
		}
	}
	return true
}

type VerifyInput struct {
	Method         string
	Path           string
	Headers        http.Header
	Query          url.Values
	AllowQueryAuth bool
	Body           []byte
	Node           string
	Now            time.Time
	Nonces         *NonceCache
}

type VerifyResult struct {
	OK     bool
	User   string
	Reason string
}

// Verify authenticates incoming signed requests identically to tools/runner/lib/sign.mjs.
func Verify(secret string, in VerifyInput) VerifyResult {
	now := in.Now
	if now.IsZero() {
		now = time.Now()
	}
	get := func(hdrKey, queryKey string) string {
		if v := in.Headers.Get(hdrKey); v != "" {
			return v
		}
		if in.AllowQueryAuth && in.Query != nil {
			return in.Query.Get(queryKey)
		}
		return ""
	}
	rawTime := get("X-Runner-Time", "time")
	nonce := get("X-Runner-Nonce", "nonce")
	user := get("X-Runner-User", "user")
	sig := get("X-Runner-Signature", "sig")
	target := get("X-Runner-Node", "node")

	ts, err := strconv.ParseInt(rawTime, 10, 64)
	if err != nil || ts == 0 || nonce == "" || sig == "" || target == "" {
		return VerifyResult{OK: false, Reason: "缺少签名"}
	}
	if !noncePattern.MatchString(nonce) || !hex64Pattern.MatchString(sig) || !userPattern.MatchString(user) {
		return VerifyResult{OK: false, Reason: "签名格式不对"}
	}
	if target != in.Node {
		shown := target
		if len(shown) > 32 {
			shown = shown[:32]
		}
		return VerifyResult{OK: false, Reason: fmt.Sprintf("这个请求是发给节点 %s 的，这里是 %s", shown, in.Node)}
	}
	skew := math.Abs(float64(now.UnixMilli())/1000.0 - float64(ts))
	if skew > MaxSkewSec {
		return VerifyResult{OK: false, Reason: "签名过期了（检查两边的时钟）"}
	}

	wantHex := Sign(secret, SignParts{
		Method:   in.Method,
		Path:     in.Path,
		Time:     ts,
		Nonce:    nonce,
		User:     user,
		Node:     in.Node,
		BodyHash: SHA256Hex(in.Body),
	})
	wantBytes, _ := hex.DecodeString(wantHex)
	gotBytes, err := hex.DecodeString(sig)
	if err != nil || len(wantBytes) != len(gotBytes) || subtle.ConstantTimeCompare(wantBytes, gotBytes) != 1 {
		return VerifyResult{OK: false, Reason: "签名不对"}
	}
	if in.Nonces != nil && !in.Nonces.CheckAndAdd(nonce, now) {
		return VerifyResult{OK: false, Reason: "这个请求已经用过了"}
	}
	return VerifyResult{OK: true, User: user}
}
