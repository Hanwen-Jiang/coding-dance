package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
)

const (
	oauthCookieName = "hot100_oauth"
	setupPath       = "/welcome/"
	sessionDays     = 30
)

var (
	ownerRepoRe   = regexp.MustCompile(`^[\w.-]+/[\w.-]+$`)
	safeRelPathRe = regexp.MustCompile(`^/[\w\-./?=&%#]*$`)
)

type oauthDest struct {
	State  string `json:"s"`
	Return string `json:"r"`
}

type familyTokens struct {
	T  string `json:"t"`
	R  string `json:"r,omitempty"`
	TE int64  `json:"te,omitempty"`
}

type ghInstallation struct {
	ID        int64
	Selection string // "all" | "selected"
	CanCreate bool
	CreatedAt string
}

type memberInfo struct {
	Tier    string  `json:"tier"`
	Founder bool    `json:"founder"`
	Since   *string `json:"since"`
}

func randomTokenB64(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func (s *Server) authConfigured() bool {
	return s.Cfg.SessionSecret != "" && s.Cfg.GitHubClientID != "" && s.Cfg.GitHubClientSecret != "" && s.Cfg.GitHubAppSlug != ""
}

func (s *Server) starRepos() []string {
	raw := s.Cfg.StarRepos
	if raw == "" {
		raw = s.Cfg.TemplateRepo
	}
	var out []string
	for _, part := range strings.Split(raw, ",") {
		p := strings.TrimSpace(part)
		if ownerRepoRe.MatchString(p) && !slices.Contains(out, p) {
			out = append(out, p)
		}
	}
	return out
}

func (s *Server) requestOrigin(r *http.Request) string {
	xfHost := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	xfProto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto"))
	if xfHost != "" {
		if xfProto != "http" && xfProto != "https" {
			xfProto = "https"
		}
		cand := xfProto + "://" + xfHost
		if slices.Contains(s.Cfg.SiteOrigins, cand) || strings.HasPrefix(xfHost, "127.0.0.1:") || strings.HasPrefix(xfHost, "localhost:") {
			return cand
		}
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(xfProto, "https") {
		scheme = "https"
	}
	if r.Host != "" {
		return scheme + "://" + r.Host
	}
	if len(s.Cfg.SiteOrigins) > 0 {
		return s.Cfg.SiteOrigins[0]
	}
	return "https://codingdance.cn"
}

func (s *Server) buildCookie(r *http.Request, name, value string, maxAge int) *http.Cookie {
	origin := s.requestOrigin(r)
	secure := strings.HasPrefix(origin, "https://")
	c := &http.Cookie{
		Name:     name,
		Value:    url.QueryEscape(value),
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	}
	if value == "" || maxAge <= 0 {
		c.Value = ""
		c.MaxAge = -1
	}
	if s.Cfg.CookieDomain != "" {
		c.Domain = s.Cfg.CookieDomain
	}
	return c
}

func safeReturnRel(v string) string {
	if !strings.HasPrefix(v, "//") && safeRelPathRe.MatchString(v) {
		return v
	}
	return "/"
}

func (s *Server) safeReturnTarget(r *http.Request, raw string) string {
	if raw == "" {
		return "/"
	}
	if !strings.HasPrefix(raw, "//") && safeRelPathRe.MatchString(raw) {
		return raw
	}
	u, err := url.Parse(raw)
	if err == nil && (u.Scheme == "http" || u.Scheme == "https") {
		origin := u.Scheme + "://" + u.Host
		if slices.Contains(s.Cfg.SiteOrigins, origin) || origin == s.requestOrigin(r) {
			return origin + safeReturnRel(u.RequestURI())
		}
	}
	return "/"
}

func withLoginFlag(targetURL, flag string) string {
	base, hash, hasHash := strings.Cut(targetURL, "#")
	sep := "?"
	if strings.Contains(base, "?") {
		sep = "&"
	}
	out := base + sep + "login=" + url.QueryEscape(flag)
	if hasHash {
		out += "#" + hash
	}
	return out
}

func viaSetupURL(targetURL string) string {
	u, err := url.Parse(targetURL)
	if err == nil && u.Scheme != "" && u.Host != "" {
		path := u.EscapedPath()
		if path == "" {
			path = "/"
		}
		if strings.HasPrefix(path, setupPath) {
			return targetURL
		}
		rel := u.RequestURI()
		if rel == "/" || rel == "" {
			return u.Scheme + "://" + u.Host + setupPath
		}
		return u.Scheme + "://" + u.Host + setupPath + "?return=" + url.QueryEscape(rel)
	}
	if strings.HasPrefix(targetURL, setupPath) {
		return targetURL
	}
	if targetURL == "" || targetURL == "/" {
		return setupPath
	}
	return setupPath + "?return=" + url.QueryEscape(targetURL)
}

func redirectNoReferrer(w http.ResponseWriter, r *http.Request, to string) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(w, r, to, http.StatusFound)
}

// ResolveSession decrypts the cookie and transparently refreshes expiring GitHub user tokens
// using the configured KVStore (Valkey or memory) to deduplicate single-use refresh tokens.
func (s *Server) ResolveSession(ctx context.Context, w http.ResponseWriter, r *http.Request) *Session {
	now := time.Now()
	sess := ReadSessionFromRequest(r, s.Cfg.SessionSecret, now)
	if sess == nil {
		return nil
	}
	if sess.TokenExpMs == 0 || sess.TokenExpMs-now.UnixMilli() > 5*60*1000 {
		return sess
	}

	adopt := func(tok familyTokens) *Session {
		next := *sess
		next.Token = tok.T
		if tok.R != "" {
			next.RefreshToken = tok.R
		}
		next.TokenExpMs = tok.TE
		if w != nil {
			if val, err := SealData(s.Cfg.SessionSecret, next); err == nil {
				maxAge := int((next.ExpMs - now.UnixMilli()) / 1000)
				if maxAge < 0 {
					maxAge = 0
				}
				http.SetCookie(w, s.buildCookie(r, SessionCookieName, val, maxAge))
			}
		}
		return &next
	}
	isNewer := func(tok *familyTokens) bool {
		if tok == nil || tok.T == "" || tok.T == sess.Token {
			return false
		}
		return tok.TE == 0 || tok.TE > sess.TokenExpMs
	}

	if sess.Family != "" && s.Quota != nil && s.Quota.KV != nil {
		if known := s.readFamilyTokens(ctx, sess.Family); isNewer(known) {
			return adopt(*known)
		}
	}
	if sess.RefreshToken != "" && s.authConfigured() {
		if fresh := s.exchangeToken(ctx, map[string]string{
			"grant_type":    "refresh_token",
			"refresh_token": sess.RefreshToken,
		}); fresh != nil {
			if fresh.R == "" {
				fresh.R = sess.RefreshToken
			}
			if sess.Family != "" && s.Quota != nil && s.Quota.KV != nil {
				ttl := time.Until(time.UnixMilli(sess.ExpMs))
				if ttl < time.Minute {
					ttl = time.Minute
				}
				if sealed, err := SealData(s.Cfg.SessionSecret, fresh); err == nil {
					_ = s.Quota.KV.Set(ctx, "fam:"+sess.Family, sealed, ttl)
				}
			}
			return adopt(*fresh)
		}
	}
	if sess.Family != "" && s.Quota != nil && s.Quota.KV != nil {
		for _, wait := range []time.Duration{400 * time.Millisecond, 1200 * time.Millisecond} {
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(wait):
			}
			if later := s.readFamilyTokens(ctx, sess.Family); isNewer(later) {
				return adopt(*later)
			}
		}
	}
	if w != nil {
		http.SetCookie(w, s.buildCookie(r, SessionCookieName, "", 0))
	}
	return nil
}

func (s *Server) readFamilyTokens(ctx context.Context, family string) *familyTokens {
	if s.Quota == nil || s.Quota.KV == nil {
		return nil
	}
	raw, ok, err := s.Quota.KV.Get(ctx, "fam:"+family)
	if err != nil || !ok {
		return nil
	}
	var ft familyTokens
	if UnsealData(s.Cfg.SessionSecret, raw, &ft) != nil {
		return nil
	}
	return &ft
}

func (s *Server) exchangeToken(ctx context.Context, params map[string]string) *familyTokens {
	payload := map[string]string{
		"client_id":     s.Cfg.GitHubClientID,
		"client_secret": s.Cfg.GitHubClientSecret,
	}
	for k, v := range params {
		payload[k] = v
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.Cfg.GitHubOAuthBase+"/login/oauth/access_token", bytes.NewReader(b))
	if err != nil {
		return nil
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "cd-api-auth/1.0")
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	var parsed struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&parsed) != nil || parsed.AccessToken == "" {
		return nil
	}
	var te int64
	if parsed.ExpiresIn > 0 {
		te = time.Now().UnixMilli() + parsed.ExpiresIn*1000
	}
	return &familyTokens{T: parsed.AccessToken, R: parsed.RefreshToken, TE: te}
}

func (s *Server) ghRequest(ctx context.Context, token, method, path string, body any) (int, []byte, error) {
	var r io.Reader
	hasBody := false
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		r = bytes.NewReader(b)
		hasBody = true
	} else if method == http.MethodPut || method == http.MethodPost || method == http.MethodPatch {
		r = bytes.NewReader(nil)
	}
	req, err := http.NewRequestWithContext(ctx, method, s.Cfg.GitHubAPIBase+path, r)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "cd-api/1.0")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if hasBody {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	return resp.StatusCode, raw, err
}

func (s *Server) userInstallation(ctx context.Context, token, login string) *ghInstallation {
	st, raw, err := s.ghRequest(ctx, token, http.MethodGet, "/user/installations?per_page=100", nil)
	if err != nil || st < 200 || st >= 300 {
		return nil
	}
	var resp struct {
		Installations []struct {
			ID          int64             `json:"id"`
			Account     struct{ Login string `json:"login"` } `json:"account"`
			Selection   string            `json:"repository_selection"`
			Permissions map[string]string `json:"permissions"`
			CreatedAt   string            `json:"created_at"`
		} `json:"installations"`
	}
	if json.Unmarshal(raw, &resp) != nil {
		return nil
	}
	for _, inst := range resp.Installations {
		if strings.EqualFold(inst.Account.Login, login) {
			sel := "selected"
			if inst.Selection == "all" {
				sel = "all"
			}
			return &ghInstallation{
				ID:        inst.ID,
				Selection: sel,
				CanCreate: inst.Permissions["repository_creation"] == "write",
				CreatedAt: inst.CreatedAt,
			}
		}
	}
	return nil
}

func (s *Server) installationCovers(ctx context.Context, token string, inst *ghInstallation, repo string) bool {
	if inst == nil {
		return false
	}
	if inst.Selection == "all" {
		return true
	}
	for page := 1; page <= 5; page++ {
		st, raw, err := s.ghRequest(ctx, token, http.MethodGet, fmt.Sprintf("/user/installations/%d/repositories?per_page=100&page=%d", inst.ID, page), nil)
		if err != nil || st < 200 || st >= 300 {
			return false
		}
		var resp struct {
			Repositories []struct {
				FullName string `json:"full_name"`
			} `json:"repositories"`
		}
		if json.Unmarshal(raw, &resp) != nil {
			return false
		}
		for _, r := range resp.Repositories {
			if strings.EqualFold(r.FullName, repo) {
				return true
			}
		}
		if len(resp.Repositories) < 100 {
			return false
		}
	}
	return false
}

func (s *Server) computeMembership(joinedAt ...string) memberInfo {
	cutoff, err := time.Parse(time.RFC3339, s.Cfg.FounderCutoff)
	if err != nil {
		return memberInfo{Tier: "free", Founder: false, Since: nil}
	}
	var earliest *time.Time
	for _, raw := range joinedAt {
		if raw == "" {
			continue
		}
		t, pErr := time.Parse(time.RFC3339, raw)
		if pErr != nil {
			continue
		}
		if earliest == nil || t.Before(*earliest) {
			cp := t
			earliest = &cp
		}
	}
	if earliest != nil && earliest.Before(cutoff) {
		since := earliest.UTC().Format("2006-01-02")
		return memberInfo{Tier: "pro", Founder: true, Since: &since}
	}
	return memberInfo{Tier: "free", Founder: false, Since: nil}
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	if !s.authConfigured() {
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "GitHub 登录还没有配置"})
		return
	}
	state := randomTokenB64(18)
	ret := s.safeReturnTarget(r, r.URL.Query().Get("return"))
	sealed, err := SealData(s.Cfg.SessionSecret, oauthDest{State: state, Return: ret})
	if err != nil {
		writePrivateJSON(w, http.StatusInternalServerError, map[string]any{"error": "生成登录状态失败"})
		return
	}
	http.SetCookie(w, s.buildCookie(r, oauthCookieName, sealed, 900))
	u, _ := url.Parse(s.Cfg.GitHubOAuthBase + "/login/oauth/authorize")
	q := u.Query()
	q.Set("client_id", s.Cfg.GitHubClientID)
	q.Set("redirect_uri", s.requestOrigin(r)+"/api/auth/callback")
	q.Set("state", state)
	u.RawQuery = q.Encode()
	redirectNoReferrer(w, r, u.String())
}

func (s *Server) handleAuthInstall(w http.ResponseWriter, r *http.Request) {
	if !s.authConfigured() {
		writePrivateJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "GitHub App 还没有配置"})
		return
	}
	state := randomTokenB64(18)
	ret := s.safeReturnTarget(r, r.URL.Query().Get("return"))
	sealed, err := SealData(s.Cfg.SessionSecret, oauthDest{State: state, Return: ret})
	if err != nil {
		writePrivateJSON(w, http.StatusInternalServerError, map[string]any{"error": "生成授权状态失败"})
		return
	}
	http.SetCookie(w, s.buildCookie(r, oauthCookieName, sealed, 900))
	u, _ := url.Parse(fmt.Sprintf("%s/apps/%s/installations/new", s.Cfg.GitHubOAuthBase, s.Cfg.GitHubAppSlug))
	q := u.Query()
	q.Set("state", state)
	u.RawQuery = q.Encode()
	redirectNoReferrer(w, r, u.String())
}

func (s *Server) handleAuthCallback(w http.ResponseWriter, r *http.Request) {
	to := "/"
	var dest *oauthDest
	if c, err := r.Cookie(oauthCookieName); err == nil && c.Value != "" {
		rawVal, uErr := url.QueryUnescape(c.Value)
		if uErr != nil {
			rawVal = c.Value
		}
		var d oauthDest
		if UnsealData(s.Cfg.SessionSecret, rawVal, &d) == nil {
			dest = &d
			to = s.safeReturnTarget(r, d.Return)
		}
	}
	http.SetCookie(w, s.buildCookie(r, oauthCookieName, "", 0))

	if !s.authConfigured() {
		redirectNoReferrer(w, r, withLoginFlag(to, "unavailable"))
		return
	}
	q := r.URL.Query()
	code := q.Get("code")
	setupAction := q.Get("setup_action")
	if code == "" && setupAction != "" {
		redirectNoReferrer(w, r, to)
		return
	}
	if code == "" || dest == nil || q.Get("state") != dest.State {
		redirectNoReferrer(w, r, withLoginFlag(to, "failed"))
		return
	}

	tok := s.exchangeToken(r.Context(), map[string]string{
		"code":         code,
		"redirect_uri": s.requestOrigin(r) + "/api/auth/callback",
	})
	if tok == nil {
		redirectNoReferrer(w, r, withLoginFlag(to, "failed"))
		return
	}

	uSt, uRaw, uErr := s.ghRequest(r.Context(), tok.T, http.MethodGet, "/user", nil)
	if uErr != nil || uSt < 200 || uSt >= 300 {
		redirectNoReferrer(w, r, withLoginFlag(to, "failed"))
		return
	}
	var ghUser struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
		CreatedAt string `json:"created_at"`
	}
	if json.Unmarshal(uRaw, &ghUser) != nil || ghUser.Login == "" {
		redirectNoReferrer(w, r, withLoginFlag(to, "failed"))
		return
	}

	now := time.Now()
	sess := Session{
		Token:        tok.T,
		RefreshToken: tok.R,
		TokenExpMs:   tok.TE,
		Login:        ghUser.Login,
		Avatar:       ghUser.AvatarURL,
		ExpMs:        now.Add(sessionDays * 24 * time.Hour).UnixMilli(),
		Family:       randomTokenB64(12),
	}
	sealedSess, err := SealData(s.Cfg.SessionSecret, sess)
	if err != nil {
		redirectNoReferrer(w, r, withLoginFlag(to, "failed"))
		return
	}
	http.SetCookie(w, s.buildCookie(r, SessionCookieName, sealedSess, sessionDays*86400))

	inst := s.userInstallation(r.Context(), tok.T, ghUser.Login)
	var repoCreatedAt string
	repoName := ghUser.Login + "/" + s.Cfg.ProgressRepo
	rSt, rRaw, _ := s.ghRequest(r.Context(), tok.T, http.MethodGet, "/repos/"+repoName, nil)
	repoExists := rSt >= 200 && rSt < 300
	if repoExists {
		var rMeta struct {
			CreatedAt string `json:"created_at"`
		}
		if json.Unmarshal(rRaw, &rMeta) == nil {
			repoCreatedAt = rMeta.CreatedAt
		}
	}
	instCreated := ""
	if inst != nil {
		instCreated = inst.CreatedAt
	}
	mem := s.computeMembership(instCreated, repoCreatedAt)
	_ = s.Store.UpsertProfile(r.Context(), UserProfile{
		Login:       ghUser.Login,
		AvatarURL:   ghUser.AvatarURL,
		Tier:        mem.Tier,
		Founder:     mem.Founder,
		GHCreatedAt: ghUser.CreatedAt,
	})

	if setupAction == "" && inst == nil {
		nextState := randomTokenB64(18)
		if nextOAuth, err := SealData(s.Cfg.SessionSecret, oauthDest{State: nextState, Return: to}); err == nil {
			http.SetCookie(w, s.buildCookie(r, oauthCookieName, nextOAuth, 900))
		}
		ghURL, _ := url.Parse(fmt.Sprintf("%s/apps/%s/installations/new", s.Cfg.GitHubOAuthBase, s.Cfg.GitHubAppSlug))
		gq := ghURL.Query()
		gq.Set("state", nextState)
		ghURL.RawQuery = gq.Encode()
		redirectNoReferrer(w, r, ghURL.String())
		return
	}

	accessible := inst != nil && repoExists && s.installationCovers(r.Context(), tok.T, inst, repoName)
	if !accessible {
		redirectNoReferrer(w, r, viaSetupURL(to))
		return
	}
	redirectNoReferrer(w, r, to)
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if !CheckWriteOrigin(r, s.Cfg.SiteOrigins) {
		writePrivateJSON(w, http.StatusForbidden, map[string]any{"error": "不接受跨站请求"})
		return
	}
	if sess := ReadSessionFromRequest(r, s.Cfg.SessionSecret, time.Now()); sess != nil && sess.Family != "" && s.Quota != nil && s.Quota.KV != nil {
		_ = s.Quota.KV.Set(r.Context(), "fam:"+sess.Family, "", time.Second)
	}
	http.SetCookie(w, s.buildCookie(r, SessionCookieName, "", 0))
	writePrivateJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	tOwner, tName, _ := strings.Cut(s.Cfg.TemplateRepo, "/")
	createURL := fmt.Sprintf("https://github.com/new?template_owner=%s&template_name=%s&name=%s&visibility=private",
		url.QueryEscape(tOwner), url.QueryEscape(tName), url.QueryEscape(s.Cfg.ProgressRepo))
	starsList := s.starRepos()
	anonStars := make([]map[string]any, len(starsList))
	for i, sr := range starsList {
		anonStars[i] = map[string]any{"repo": sr, "starred": false}
	}
	base := map[string]any{
		"configured": s.authConfigured(),
		"template":   s.Cfg.TemplateRepo,
		"repoName":   s.Cfg.ProgressRepo,
		"createUrl":  createURL,
	}

	sess := s.ResolveSession(r.Context(), w, r)
	if sess == nil {
		base["user"] = nil
		base["repo"] = nil
		base["starred"] = false
		base["stars"] = anonStars
		writePrivateJSON(w, http.StatusOK, base)
		return
	}

	repoName := sess.Login + "/" + s.Cfg.ProgressRepo
	var (
		meSt, repoSt   int
		meRaw, repoRaw []byte
		inst           *ghInstallation
		starSt         = make([]int, len(starsList))
		wg             sync.WaitGroup
	)
	wg.Add(3 + len(starsList))
	go func() { defer wg.Done(); meSt, meRaw, _ = s.ghRequest(r.Context(), sess.Token, http.MethodGet, "/user", nil) }()
	go func() {
		defer wg.Done()
		repoSt, repoRaw, _ = s.ghRequest(r.Context(), sess.Token, http.MethodGet, "/repos/"+repoName, nil)
	}()
	go func() { defer wg.Done(); inst = s.userInstallation(r.Context(), sess.Token, sess.Login) }()
	for i, sr := range starsList {
		idx, target := i, sr
		go func() {
			defer wg.Done()
			st, _, _ := s.ghRequest(r.Context(), sess.Token, http.MethodGet, "/user/starred/"+target, nil)
			starSt[idx] = st
		}()
	}
	wg.Wait()

	if meSt == http.StatusUnauthorized {
		http.SetCookie(w, s.buildCookie(r, SessionCookieName, "", 0))
		base["user"] = nil
		base["repo"] = nil
		base["starred"] = false
		base["stars"] = anonStars
		writePrivateJSON(w, http.StatusOK, base)
		return
	}

	repoExists := repoSt >= 200 && repoSt < 300
	accessible := inst != nil && repoExists && s.installationCovers(r.Context(), sess.Token, inst, repoName)

	allStarred := true
	starsOut := make([]map[string]any, len(starsList))
	for i, sr := range starsList {
		ok := starSt[i] == http.StatusNoContent
		if !ok {
			allStarred = false
		}
		starsOut[i] = map[string]any{"repo": sr, "starred": ok}
	}

	var meMeta struct {
		CreatedAt string `json:"created_at"`
	}
	_ = json.Unmarshal(meRaw, &meMeta)
	var repoMeta struct {
		CreatedAt string `json:"created_at"`
	}
	if repoExists {
		_ = json.Unmarshal(repoRaw, &repoMeta)
	}
	instCreated := ""
	var manageURL any = nil
	installed := inst != nil
	canCreate := false
	if inst != nil {
		instCreated = inst.CreatedAt
		canCreate = inst.CanCreate
		manageURL = fmt.Sprintf("https://github.com/settings/installations/%d", inst.ID)
	}
	mem := s.computeMembership(instCreated, repoMeta.CreatedAt)
	_ = s.Store.UpsertProfile(r.Context(), UserProfile{
		Login:       sess.Login,
		AvatarURL:   sess.Avatar,
		Tier:        mem.Tier,
		Founder:     mem.Founder,
		GHCreatedAt: meMeta.CreatedAt,
	})

	base["user"] = map[string]any{"login": sess.Login, "avatar": sess.Avatar}
	base["member"] = mem
	base["repo"] = map[string]any{
		"name":       repoName,
		"url":        "https://github.com/" + repoName,
		"exists":     repoExists,
		"accessible": accessible,
		"installed":  installed,
		"canCreate":  canCreate,
		"manageUrl":  manageURL,
	}
	base["starred"] = allStarred
	base["stars"] = starsOut
	base["spread"] = nil
	writePrivateJSON(w, http.StatusOK, base)
}

func (s *Server) handleProgressCreate(w http.ResponseWriter, r *http.Request) {
	sess, _, _, ok := s.requireAuth(w, r, true)
	if !ok {
		return
	}
	var body struct {
		Private *bool `json:"private"`
	}
	_ = json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body)
	isPrivate := body.Private == nil || *body.Private

	st, raw, err := s.ghRequest(r.Context(), sess.Token, http.MethodPost, "/repos/"+s.Cfg.TemplateRepo+"/generate", map[string]any{
		"owner":                sess.Login,
		"name":                 s.Cfg.ProgressRepo,
		"private":              isPrivate,
		"include_all_branches": false,
		"description":          "力扣热题 100：我的进度、题解和尝试记录",
	})
	if err == nil && st == http.StatusCreated {
		// Initialize empty hydrated state immediately so subsequent reads stay instant.
		_ = s.Store.ReplaceFromHydration(r.Context(), sess.Login, HydratedRepo{}, time.Now())
		writePrivateJSON(w, http.StatusOK, map[string]any{"created": true})
		return
	}
	var ghErr struct {
		Message string `json:"message"`
		Errors  any    `json:"errors"`
	}
	_ = json.Unmarshal(raw, &ghErr)
	combined := ghErr.Message + " "
	if ghErr.Errors != nil {
		eb, _ := json.Marshal(ghErr.Errors)
		combined += string(eb)
	}
	switch {
	case st == http.StatusUnprocessableEntity && strings.Contains(strings.ToLower(combined), "exist"):
		writePrivateJSON(w, http.StatusConflict, map[string]any{"code": "exists", "error": fmt.Sprintf("你的账号下已经有 %s 这个仓库了", s.Cfg.ProgressRepo)})
	case st == http.StatusForbidden || st == http.StatusNotFound:
		writePrivateJSON(w, http.StatusForbidden, map[string]any{"code": "forbidden", "error": "GitHub 没让网站替你建仓库：这次授权里没有建仓库的权限"})
	default:
		msg := fmt.Sprintf("建仓库失败（GitHub %d", st)
		if ghErr.Message != "" {
			msg += "：" + ghErr.Message
		}
		msg += "）"
		writePrivateJSON(w, http.StatusBadGateway, map[string]any{"code": "failed", "error": msg})
	}
}

func (s *Server) handleProgressStar(w http.ResponseWriter, r *http.Request) {
	sess, _, _, ok := s.requireAuth(w, r, true)
	if !ok {
		return
	}
	var body struct {
		Repos []string `json:"repos"`
	}
	_ = json.NewDecoder(io.LimitReader(r.Body, 8192)).Decode(&body)
	allowed := s.starRepos()
	var want []string
	for _, repo := range body.Repos {
		if slices.Contains(allowed, repo) && !slices.Contains(want, repo) {
			want = append(want, repo)
		}
	}
	if len(want) == 0 {
		writePrivateJSON(w, http.StatusBadRequest, map[string]any{"error": "没有选仓库"})
		return
	}
	results := make([]map[string]any, len(want))
	var wg sync.WaitGroup
	wg.Add(len(want))
	for i, repo := range want {
		idx, target := i, repo
		go func() {
			defer wg.Done()
			st, _, _ := s.ghRequest(r.Context(), sess.Token, http.MethodPut, "/user/starred/"+target, nil)
			results[idx] = map[string]any{"repo": target, "starred": st == http.StatusNoContent, "status": st}
		}()
	}
	wg.Wait()
	writePrivateJSON(w, http.StatusOK, map[string]any{"results": results})
}
