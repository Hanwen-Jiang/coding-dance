package api

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/Hanwen-Jiang/coding-dance/internal/progress"
)

//go:embed migrations/001_init.sql
var PostgresMigrationSQL string

type UserProfile struct {
	Login       string `json:"login"`
	AvatarURL   string `json:"avatarUrl"`
	Tier        string `json:"tier"` // "free" | "pro"
	Founder     bool   `json:"founder"`
	GHCreatedAt string `json:"ghCreatedAt,omitempty"`
	RepoSynced  bool   `json:"repoSynced,omitempty"`
}

func (p UserProfile) ToQuotaProfile() QuotaProfile {
	tier := p.Tier
	if tier == "" {
		tier = "free"
	}
	return QuotaProfile{Tier: tier, Founder: p.Founder, CreatedAt: p.GHCreatedAt}
}

type OutboxItem struct {
	ID          int64     `json:"id"`
	Login       string    `json:"login"`
	Repo        string    `json:"repo"`
	TokenSealed string    `json:"tokenSealed"`
	FilePath    string    `json:"filePath"`
	Content     string    `json:"content"`
	CommitMsg   string    `json:"commitMsg"`
	CreatedAt   time.Time `json:"createdAt"`
	NextRetryAt time.Time `json:"nextRetryAt"`
	SyncedAt    time.Time `json:"syncedAt"`
	SyncedSHA   string    `json:"syncedSha,omitempty"`
	Attempts    int       `json:"attempts"`
	LastError   string    `json:"lastError,omitempty"`
}

type ProgressOverview struct {
	Status   map[string]string   `json:"status"`
	Langs    map[string][]string `json:"langs"`
	Settings map[string]any      `json:"settings"`
}

type PracticeSaveResponse struct {
	Saved    bool     `json:"saved"`
	Queued   bool     `json:"queued"`
	Files    []string `json:"files"`
	Attempt  string   `json:"attempt,omitempty"`
	Solution string   `json:"solution,omitempty"`
	Draft    string   `json:"draft,omitempty"`
	Status   string   `json:"status,omitempty"`
}

type ProblemHistoryResponse struct {
	History  []progress.HistoryFile `json:"history"`
	Attempts []progress.Attempt     `json:"attempts"`
}

type DraftSeed struct {
	ProblemID int
	Lang      string
	Mode      string
	FilePath  string
	Code      string
}

type SolutionSeed struct {
	FilePath  string
	ProblemID int
	Lang      string
	Code      string
}

type AttemptSeed struct {
	ProblemID int
	Date      string
	Seq       int
	Result    string
	Lang      string
	Mode      string
	FilePath  string
	Markdown  string
}

type HydratedRepo struct {
	Progress  map[string]progress.ProgressEntry
	Settings  []string
	Drafts    []DraftSeed
	Solutions []SolutionSeed
	Attempts  []AttemptSeed
	AllPaths  []string
}

// Store abstracts HotStore operations across PostgreSQL (production) and MemoryStore (local dev / unit tests).
type Store interface {
	Problem(id int) (progress.ProblemMeta, bool)
	UpsertProfile(ctx context.Context, p UserProfile) error
	GetProfile(ctx context.Context, login string) (UserProfile, bool, error)
	IsHydrated(ctx context.Context, login string) (bool, error)
	ReplaceFromHydration(ctx context.Context, login string, data HydratedRepo, now time.Time) error
	LoadOverview(ctx context.Context, login string) (ProgressOverview, error)
	SaveStatus(ctx context.Context, login, repo, sealedToken string, id int, status string, now time.Time) (ProgressOverview, error)
	SaveSettings(ctx context.Context, login, repo, sealedToken string, langs []string, now time.Time) ([]string, error)
	GetDraft(ctx context.Context, login string, id int, lang, mode string) (code, path string, ok bool, err error)
	SavePractice(ctx context.Context, login, repo, sealedToken string, save progress.PracticeSave, now time.Time) (PracticeSaveResponse, error)
	LoadProblemHistory(ctx context.Context, login string, id int) (ProblemHistoryResponse, error)
	PendingBatchForNextUser(ctx context.Context, now time.Time) (login, repo, sealedToken string, items []OutboxItem, err error)
	MarkOutboxSynced(ctx context.Context, ids []int64, commitSHA string, now time.Time) error
	MarkOutboxRetry(ctx context.Context, ids []int64, errStr string, backoff time.Duration, now time.Time) error
	OutboxCounts(ctx context.Context) (pending, synced int, err error)
	Close() error
}

// MemoryStore is the thread-safe in-memory (and optional JSON snapshot) implementation of Store.
type MemoryStore struct {
	mu           sync.RWMutex
	snapshotFile string
	problems     map[int]progress.ProblemMeta

	profiles        map[string]UserProfile
	hydrated        map[string]bool
	progressByUser  map[string]map[string]progress.ProgressEntry // login -> problemID -> entry
	settingsByUser  map[string][]string                          // login -> langs
	draftsByUser    map[string]map[string]string                 // login -> "id:lang:mode" -> code
	pathsByUser     map[string]map[string]struct{}               // login -> virtual repo file path set
	solutionsByUser map[string]map[string]string                 // login -> path -> code
	attemptsByUser  map[string]map[string]string                 // login -> path -> markdown
	outbox          []*OutboxItem
	nextOutboxID    int64
}

func NewHotStore(problems []progress.ProblemMeta, snapshotFile string) *MemoryStore {
	pm := make(map[int]progress.ProblemMeta, len(problems))
	for _, p := range problems {
		pm[p.ID] = p
	}
	s := &MemoryStore{
		snapshotFile:    snapshotFile,
		problems:        pm,
		profiles:        make(map[string]UserProfile),
		hydrated:        make(map[string]bool),
		progressByUser:  make(map[string]map[string]progress.ProgressEntry),
		settingsByUser:  make(map[string][]string),
		draftsByUser:    make(map[string]map[string]string),
		pathsByUser:     make(map[string]map[string]struct{}),
		solutionsByUser: make(map[string]map[string]string),
		attemptsByUser:  make(map[string]map[string]string),
		nextOutboxID:    1,
	}
	if snapshotFile != "" {
		s.loadSnapshot()
	}
	return s
}

func (s *MemoryStore) Problem(id int) (progress.ProblemMeta, bool) {
	p, ok := s.problems[id]
	return p, ok
}

func (s *MemoryStore) ensureUserLocked(login string) {
	if s.progressByUser[login] == nil {
		s.progressByUser[login] = make(map[string]progress.ProgressEntry)
	}
	if s.draftsByUser[login] == nil {
		s.draftsByUser[login] = make(map[string]string)
	}
	if s.pathsByUser[login] == nil {
		s.pathsByUser[login] = make(map[string]struct{})
	}
	if s.solutionsByUser[login] == nil {
		s.solutionsByUser[login] = make(map[string]string)
	}
	if s.attemptsByUser[login] == nil {
		s.attemptsByUser[login] = make(map[string]string)
	}
}

func draftMapKey(id int, lang, mode string) string {
	return fmt.Sprintf("%d:%s:%s", id, lang, mode)
}

func (s *MemoryStore) UpsertProfile(_ context.Context, p UserProfile) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	prev := s.profiles[p.Login]
	p.RepoSynced = p.RepoSynced || prev.RepoSynced
	if p.GHCreatedAt == "" {
		p.GHCreatedAt = prev.GHCreatedAt
	}
	s.profiles[p.Login] = p
	s.persistSnapshotLocked()
	return nil
}

func (s *MemoryStore) GetProfile(_ context.Context, login string) (UserProfile, bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.profiles[login]
	return p, ok, nil
}

func (s *MemoryStore) IsHydrated(_ context.Context, login string) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.hydrated[login], nil
}

func (s *MemoryStore) ReplaceFromHydration(_ context.Context, login string, data HydratedRepo, _ time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.progressByUser[login] = make(map[string]progress.ProgressEntry, len(data.Progress))
	for k, v := range data.Progress {
		s.progressByUser[login][k] = v
	}
	if len(data.Settings) > 0 {
		s.settingsByUser[login] = append([]string(nil), data.Settings...)
	} else {
		delete(s.settingsByUser, login)
	}
	s.draftsByUser[login] = make(map[string]string, len(data.Drafts))
	for _, d := range data.Drafts {
		s.draftsByUser[login][draftMapKey(d.ProblemID, d.Lang, d.Mode)] = d.Code
	}
	s.solutionsByUser[login] = make(map[string]string, len(data.Solutions))
	for _, sol := range data.Solutions {
		s.solutionsByUser[login][sol.FilePath] = sol.Code
	}
	s.attemptsByUser[login] = make(map[string]string, len(data.Attempts))
	for _, att := range data.Attempts {
		s.attemptsByUser[login][att.FilePath] = att.Markdown
	}
	s.pathsByUser[login] = make(map[string]struct{}, len(data.AllPaths))
	for _, p := range data.AllPaths {
		s.pathsByUser[login][p] = struct{}{}
	}
	s.hydrated[login] = true
	if prof, ok := s.profiles[login]; ok {
		prof.RepoSynced = true
		s.profiles[login] = prof
	}
	s.persistSnapshotLocked()
	return nil
}

func (s *MemoryStore) LoadOverview(_ context.Context, login string) (ProgressOverview, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	statusOut := make(map[string]string)
	for k, v := range s.progressByUser[login] {
		if slices.Contains(progress.ValidStatuses, v.Status) && v.Status != "未开始" {
			statusOut[k] = v.Status
		}
	}
	langsOut := make(map[string][]string)
	for p := range s.solutionsByUser[login] {
		if pid, lang, _, ok := progress.ParseSolutionPath(p); ok {
			key := strconv.Itoa(pid)
			if !slices.Contains(langsOut[key], lang) {
				langsOut[key] = append(langsOut[key], lang)
			}
		}
	}
	var settings map[string]any
	if langs := s.settingsByUser[login]; len(langs) > 0 {
		settings = map[string]any{"langs": append([]string(nil), langs...)}
	}
	return ProgressOverview{
		Status:   statusOut,
		Langs:    langsOut,
		Settings: settings,
	}, nil
}

func (s *MemoryStore) SaveStatus(ctx context.Context, login, repo, sealedToken string, id int, status string, now time.Time) (ProgressOverview, error) {
	s.mu.Lock()
	s.ensureUserLocked(login)
	key := strconv.Itoa(id)
	if status == "未开始" {
		delete(s.progressByUser[login], key)
	} else {
		bjDate, _ := progress.BeijingParts(now)
		s.progressByUser[login][key] = progress.ProgressEntry{Status: status, UpdatedAt: bjDate}
	}
	s.pathsByUser[login]["progress.json"] = struct{}{}
	progContent := progress.WriteProgressJSON(s.progressByUser[login])
	s.enqueueOutboxLocked(login, repo, sealedToken, "progress.json", progContent, fmt.Sprintf("进度：第 %d 题 → %s", id, status), now)
	s.persistSnapshotLocked()
	s.mu.Unlock()
	return s.LoadOverview(ctx, login)
}

func (s *MemoryStore) SaveSettings(_ context.Context, login, repo, sealedToken string, langs []string, now time.Time) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureUserLocked(login)
	s.settingsByUser[login] = append([]string(nil), langs...)
	s.pathsByUser[login]["settings.json"] = struct{}{}
	labels := make([]string, len(langs))
	for i, l := range langs {
		if lbl, ok := progress.LangLabel[l]; ok {
			labels[i] = lbl
		} else {
			labels[i] = l
		}
	}
	msg := "设置：常用语言 → " + joinStr(labels, "、")
	s.enqueueOutboxLocked(login, repo, sealedToken, "settings.json", progress.WriteSettingsJSON(langs), msg, now)
	s.persistSnapshotLocked()
	return langs, nil
}

func joinStr(xs []string, sep string) string {
	if len(xs) == 0 {
		return ""
	}
	out := xs[0]
	for _, x := range xs[1:] {
		out += sep + x
	}
	return out
}

func (s *MemoryStore) GetDraft(_ context.Context, login string, id int, lang, mode string) (string, string, bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	dm := s.draftsByUser[login]
	if dm == nil {
		return "", "", false, nil
	}
	c, exists := dm[draftMapKey(id, lang, mode)]
	if !exists {
		return "", "", false, nil
	}
	prob := s.problems[id]
	return c, progress.DraftPath(prob, lang, mode), true, nil
}

func (s *MemoryStore) SavePractice(_ context.Context, login, repo, sealedToken string, save progress.PracticeSave, now time.Time) (PracticeSaveResponse, error) {
	prob, exists := s.problems[save.ID]
	if !exists {
		return PracticeSaveResponse{}, &progress.ValidationError{Message: "这道题不在热题 100 题库里", Status: 404}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureUserLocked(login)

	paths := make([]string, 0, len(s.pathsByUser[login]))
	for p := range s.pathsByUser[login] {
		paths = append(paths, p)
	}
	sort.Strings(paths)

	if save.Kind == "draft" {
		tidy := progress.TidyCode(save.Code)
		dk := draftMapKey(save.ID, save.Lang, save.Mode)
		prev, hadPrev := s.draftsByUser[login][dk]
		dp := progress.DraftPath(prob, save.Lang, save.Mode)
		if hadPrev && prev == tidy {
			return PracticeSaveResponse{Saved: false, Queued: false, Files: []string{}, Draft: dp}, nil
		}
		s.draftsByUser[login][dk] = tidy
		s.pathsByUser[login][dp] = struct{}{}
		plan, _ := progress.PlanPracticeSave(save, progress.PlanContext{Problem: prob, Now: now})
		s.enqueueOutboxLocked(login, repo, sealedToken, dp, tidy, plan.Message, now)
		s.persistSnapshotLocked()
		return PracticeSaveResponse{
			Saved:  true,
			Queued: true,
			Files:  []string{dp},
			Draft:  dp,
		}, nil
	}

	plan, err := progress.PlanPracticeSave(save, progress.PlanContext{
		Problem:           prob,
		ExistingPaths:     paths,
		Progress:          s.progressByUser[login],
		ExistingSolutions: s.solutionsByUser[login],
		Now:               now,
	})
	if err != nil {
		return PracticeSaveResponse{}, err
	}
	if len(plan.Files) == 0 {
		return PracticeSaveResponse{
			Saved:    false,
			Queued:   false,
			Files:    []string{},
			Attempt:  plan.Attempt,
			Solution: plan.Solution,
			Status:   plan.Status,
		}, nil
	}

	fileNames := make([]string, 0, len(plan.Files))
	for _, f := range plan.Files {
		fileNames = append(fileNames, f.Path)
		s.pathsByUser[login][f.Path] = struct{}{}
		if f.Path == plan.Solution {
			s.solutionsByUser[login][f.Path] = f.Content
		}
		if f.Path == plan.Attempt {
			s.attemptsByUser[login][f.Path] = f.Content
		}
		if f.Path == "progress.json" && plan.Status != "" {
			bjDate, _ := progress.BeijingParts(now)
			s.progressByUser[login][strconv.Itoa(save.ID)] = progress.ProgressEntry{
				Status:    plan.Status,
				UpdatedAt: bjDate,
			}
		}
		s.enqueueOutboxLocked(login, repo, sealedToken, f.Path, f.Content, plan.Message, now)
	}
	s.persistSnapshotLocked()
	return PracticeSaveResponse{
		Saved:    true,
		Queued:   true,
		Files:    fileNames,
		Attempt:  plan.Attempt,
		Solution: plan.Solution,
		Status:   plan.Status,
	}, nil
}

func (s *MemoryStore) LoadProblemHistory(_ context.Context, login string, id int) (ProblemHistoryResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return buildProblemHistory(id, s.solutionsByUser[login], s.attemptsByUser[login]), nil
}

func buildProblemHistory(id int, solutions map[string]string, attempts map[string]string) ProblemHistoryResponse {
	history := []progress.HistoryFile{}
	for path, src := range solutions {
		pid, lang, variant, ok := progress.ParseSolutionPath(path)
		if !ok || pid != id {
			continue
		}
		lbl := progress.LangLabel[lang]
		if lbl == "" {
			lbl = lang
		}
		if variant != "" {
			lbl += " · " + variant
		}
		history = append(history, progress.HistoryFile{
			Lang:  lang,
			Label: lbl,
			File:  path,
			Code:  progress.TrimSolution(lang, src),
		})
	}
	order := progress.LangOrder()
	sort.Slice(history, func(i, j int) bool {
		oi := slices.Index(order, history[i].Lang)
		oj := slices.Index(order, history[j].Lang)
		if oi != oj {
			return oi < oj
		}
		return history[i].File < history[j].File
	})

	attOut := []progress.Attempt{}
	for path, md := range attempts {
		pid, _, _, _, ok := progress.ParseAttemptPath(path)
		if !ok || pid != id {
			continue
		}
		if parsed, ok := progress.ParseAttemptFull(path, md); ok {
			attOut = append(attOut, parsed)
		}
	}
	sort.Slice(attOut, func(i, j int) bool {
		if attOut[i].Date != attOut[j].Date {
			return attOut[i].Date < attOut[j].Date
		}
		return attOut[i].Seq < attOut[j].Seq
	})
	return ProblemHistoryResponse{History: history, Attempts: attOut}
}

func (s *MemoryStore) enqueueOutboxLocked(login, repo, sealedToken, filePath, content, commitMsg string, now time.Time) {
	id := s.nextOutboxID
	s.nextOutboxID++
	s.outbox = append(s.outbox, &OutboxItem{
		ID:          id,
		Login:       login,
		Repo:        repo,
		TokenSealed: sealedToken,
		FilePath:    filePath,
		Content:     content,
		CommitMsg:   commitMsg,
		CreatedAt:   now,
		NextRetryAt: now,
	})
}

func (s *MemoryStore) PendingBatchForNextUser(_ context.Context, now time.Time) (login, repo, sealedToken string, items []OutboxItem, err error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, it := range s.outbox {
		if !it.SyncedAt.IsZero() || now.Before(it.NextRetryAt) {
			continue
		}
		if login == "" {
			login = it.Login
			repo = it.Repo
		}
		if it.Login == login && it.Repo == repo {
			sealedToken = it.TokenSealed
			items = append(items, *it)
		}
	}
	return login, repo, sealedToken, items, nil
}

func (s *MemoryStore) MarkOutboxSynced(_ context.Context, ids []int64, commitSHA string, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	idSet := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		idSet[id] = struct{}{}
	}
	for _, it := range s.outbox {
		if _, ok := idSet[it.ID]; ok {
			it.SyncedAt = now
			it.SyncedSHA = commitSHA
			it.LastError = ""
		}
	}
	s.persistSnapshotLocked()
	return nil
}

func (s *MemoryStore) MarkOutboxRetry(_ context.Context, ids []int64, errStr string, backoff time.Duration, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	idSet := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		idSet[id] = struct{}{}
	}
	for _, it := range s.outbox {
		if _, ok := idSet[it.ID]; ok {
			it.Attempts++
			it.LastError = errStr
			it.NextRetryAt = now.Add(backoff)
		}
	}
	s.persistSnapshotLocked()
	return nil
}

func (s *MemoryStore) OutboxCounts(_ context.Context) (pending, synced int, err error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, it := range s.outbox {
		if it.SyncedAt.IsZero() {
			pending++
		} else {
			synced++
		}
	}
	return pending, synced, nil
}

func (s *MemoryStore) Close() error { return nil }

type storeSnapshot struct {
	Profiles  map[string]UserProfile                       `json:"profiles"`
	Hydrated  map[string]bool                              `json:"hydrated"`
	Progress  map[string]map[string]progress.ProgressEntry `json:"progress"`
	Settings  map[string][]string                          `json:"settings"`
	Drafts    map[string]map[string]string                 `json:"drafts"`
	Paths     map[string]map[string]struct{}               `json:"paths"`
	Solutions map[string]map[string]string                 `json:"solutions"`
	Attempts  map[string]map[string]string                 `json:"attempts"`
	Outbox    []*OutboxItem                                `json:"outbox"`
	NextID    int64                                        `json:"nextId"`
}

func (s *MemoryStore) persistSnapshotLocked() {
	if s.snapshotFile == "" {
		return
	}
	b, err := json.Marshal(storeSnapshot{
		Profiles:  s.profiles,
		Hydrated:  s.hydrated,
		Progress:  s.progressByUser,
		Settings:  s.settingsByUser,
		Drafts:    s.draftsByUser,
		Paths:     s.pathsByUser,
		Solutions: s.solutionsByUser,
		Attempts:  s.attemptsByUser,
		Outbox:    s.outbox,
		NextID:    s.nextOutboxID,
	})
	if err == nil {
		_ = os.WriteFile(s.snapshotFile, b, 0o600)
	}
}

func (s *MemoryStore) loadSnapshot() {
	raw, err := os.ReadFile(s.snapshotFile)
	if err != nil {
		return
	}
	var snap storeSnapshot
	if json.Unmarshal(raw, &snap) == nil {
		if snap.Profiles != nil {
			s.profiles = snap.Profiles
		}
		if snap.Hydrated != nil {
			s.hydrated = snap.Hydrated
		}
		if snap.Progress != nil {
			s.progressByUser = snap.Progress
		}
		if snap.Settings != nil {
			s.settingsByUser = snap.Settings
		}
		if snap.Drafts != nil {
			s.draftsByUser = snap.Drafts
		}
		if snap.Paths != nil {
			s.pathsByUser = snap.Paths
		}
		if snap.Solutions != nil {
			s.solutionsByUser = snap.Solutions
		}
		if snap.Attempts != nil {
			s.attemptsByUser = snap.Attempts
		}
		s.outbox = snap.Outbox
		if snap.NextID > 0 {
			s.nextOutboxID = snap.NextID
		}
	}
}
