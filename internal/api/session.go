package api

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"
)

const SessionCookieName = "hot100_session"

// Session matches site/functions/_lib/session.ts exact JSON payload so cookies sealed
// by Cloudflare Pages Functions or cd-api are mutually readable.
type Session struct {
	Token        string `json:"t"`
	RefreshToken string `json:"r,omitempty"`
	TokenExpMs   int64  `json:"te,omitempty"`
	Login        string `json:"l"`
	Avatar       string `json:"a"`
	ExpMs        int64  `json:"exp"`
	Family       string `json:"f,omitempty"`
	LinkedTag    string `json:"lk,omitempty"`
}

func deriveAESKey(secret string) []byte {
	sum := sha256.Sum256([]byte(strings.TrimSpace(secret)))
	return sum[:]
}

// SealData encrypts v using AES-256-GCM formatted as "<base64url(iv[12])>.<base64url(ciphertext||tag)>",
// bit-for-bit identical to WebCrypto AES-GCM in site/functions/_lib/session.ts.
func SealData(secret string, v any) (string, error) {
	if strings.TrimSpace(secret) == "" {
		return "", errors.New("missing SESSION_SECRET")
	}
	pt, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(deriveAESKey(secret))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	var iv [12]byte
	if _, err := rand.Read(iv[:]); err != nil {
		return "", err
	}
	ct := gcm.Seal(nil, iv[:], pt, nil)
	return base64.RawURLEncoding.EncodeToString(iv[:]) + "." + base64.RawURLEncoding.EncodeToString(ct), nil
}

// UnsealData decrypts a "<base64url(iv)>.<base64url(ct)>" token into out.
func UnsealData(secret, sealed string, out any) error {
	if strings.TrimSpace(secret) == "" {
		return errors.New("missing SESSION_SECRET")
	}
	ivPart, ctPart, ok := strings.Cut(sealed, ".")
	if !ok || ivPart == "" || ctPart == "" {
		return errors.New("malformed sealed token")
	}
	iv, err := base64.RawURLEncoding.DecodeString(ivPart)
	if err != nil || len(iv) != 12 {
		return errors.New("invalid iv")
	}
	ct, err := base64.RawURLEncoding.DecodeString(ctPart)
	if err != nil {
		return errors.New("invalid ciphertext")
	}
	block, err := aes.NewCipher(deriveAESKey(secret))
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	pt, err := gcm.Open(nil, iv, ct, nil)
	if err != nil {
		return err
	}
	return json.Unmarshal(pt, out)
}

func ReadSessionFromRequest(r *http.Request, secret string, now time.Time) *Session {
	if strings.TrimSpace(secret) == "" {
		return nil
	}
	c, err := r.Cookie(SessionCookieName)
	if err != nil || c.Value == "" {
		return nil
	}
	val, err := url.QueryUnescape(c.Value)
	if err != nil {
		val = c.Value
	}
	var s Session
	if err := UnsealData(secret, val, &s); err != nil {
		return nil
	}
	if s.Login == "" || s.ExpMs <= now.UnixMilli() {
		return nil
	}
	return &s
}

func ParseAllowedOrigins(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		o := strings.TrimRight(strings.TrimSpace(part), "/")
		if o != "" && !slices.Contains(out, o) {
			out = append(out, o)
		}
	}
	return out
}

// CheckWriteOrigin verifies CSRF Origin header against same-host or configured SITE_ORIGINS allowlist.
func CheckWriteOrigin(r *http.Request, allowedOrigins []string) bool {
	origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/")
	if origin == "" {
		return false
	}
	if slices.Contains(allowedOrigins, origin) {
		return true
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	return origin == scheme+"://"+r.Host
}
