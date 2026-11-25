package api

import (
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

// HotStore provides sub-millisecond reads/writes for drafts, attempts, solutions, progress,
// and transactional Git sync outbox items.
type HotStore struct {
	mu           sync.RWMutex
	snapshotFile string
	problems     map[int]progress.ProblemMeta

	progressByUser  map[string]map[string]progress.ProgressEntry // login -> problemID -> entry
	settingsByUser  map[string][]string                          // login -> langs
	draftsByUser    map[string]map[string]string                 // login -> "id:lang:mode" -> code
	pathsByUser     map[string]map[string]struct{}               // login -> virtual repo file path set
	solutionsByUser map[string]map[string]string                 // login -> path -> code
	outbox          []*OutboxItem
	nextOutboxID    int64
}

func NewHotStore(problems []progress.ProblemMeta, snapshotFile string) *HotStore {
	pm := make(map[int]progress.ProblemMeta, len(problems))
	for _, p := range problems {
		pm[p.ID] = p
	}
	s := &HotStore{
		snapshotFile:    snapshotFile,
		problems:        pm,
		progressByUser:  make(map[string]map[string]progress.ProgressEntry),
		settingsByUser:  make(map[string][]string),
		draftsByUser:    make(map[string]map[string]string),
		pathsByUser:     make(map[string]map[string]struct{}),
		solutionsByUser: make(map[string]map[string]string),
		nextOutboxID:    1,
	}
	if snapshotFile != "" {
		s.loadSnapshot()
	}
	return s
}

func (s *HotStore) Problem(id int) (progress.ProblemMeta, bool) {
	p, ok := s.problems[id]
	return p, ok
}

func (s *HotStore) ensureUserLocked(login string) {
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
}

func draftMapKey(id int, lang, mode string) string {
	return fmt.Sprintf("%d:%s:%s", id, lang, mode)
}

func (s *HotStore) LoadOverview(login string) ProgressOverview {
	s.mu.RLock()
	defer s.mu.RUnlock()

	statusOut := make(map[string]string)
	for k, v := range s.progressByUser[login] {
		if slices.Contains(progress.ValidStatuses, v.Status) && v.Status != "未开始" {
			statusOut[k] = v.Status
		}
	}
	langsOut := make(map[string][]string)
	for path := range s.solutionsByUser[login] {
		if pid, lang, ok := parseSolutionPathQuick(path); ok {
			key := strconv.Itoa(pid)
			if !slices.Contains(langsOut[key], lang) {
				langsOut[key] = append(langsOut[key], lang)
			}
		}
	}
	var settings any
	if langs := s.settingsByUser[login]; len(langs) > 0 {
		settings = map[string]any{"langs": langs}
	}
	return ProgressOverview{
		Status:   statusOut,
		Langs:    langsOut,
		Settings: toSettingsMap(settings),
	}
}

func toSettingsMap(v any) map[string]any {
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return nil
}

func parseSolutionPathQuick(p string) (int, string, bool) {
	// solutions/<lang>/<pad4>.<rest>
	var lang string
	rest, ok := cutPrefix(p, "solutions/")
	if !ok {
		return 0, "", false
	}
	idx := indexByte(rest, '/')
	if idx <= 0 || idx+5 >= len(rest) || rest[idx+5] != '.' {
		return 0, "", false
	}
	lang = rest[:idx]
	if _, ok := progress.PracticeExt[lang]; !ok {
		return 0, "", false
	}
	id, err := strconv.Atoi(rest[idx+1 : idx+5])
	if err != nil {
		return 0, "", false
	}
	return id, lang, true
}

func cutPrefix(s, p string) (string, bool) {
	if len(s) >= len(p) && s[:len(p)] == p {
		return s[len(p):], true
	}
	return s, false
}

func indexByte(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

func (s *HotStore) SaveStatus(login, repo, sealedToken string, id int, status string, now time.Time) ProgressOverview {
	s.mu.Lock()
	s.ensureUserLocked(login)
	key := strconv.Itoa(id)
	if status == "未开始" {
		delete(s.progressByUser[login], key)
	} else {
		bjDate, _ := progress.BeijingParts(now)
		s.progressByUser[login][key] = progress.ProgressEntry{Status: status, UpdatedAt: bjDate}
	}
	progContent := progress.WriteProgressJSON(s.progressByUser[login])
	s.enqueueOutboxLocked(login, repo, sealedToken, "progress.json", progContent, fmt.Sprintf("进度：第 %d 题 → %s", id, status), now)
	s.persistSnapshotLocked()
	s.mu.Unlock()
	return s.LoadOverview(login)
}

func (s *HotStore) SaveSettings(login, repo, sealedToken string, langs []string, now time.Time) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureUserLocked(login)
	s.settingsByUser[login] = append([]string(nil), langs...)
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
	return langs
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

func (s *HotStore) GetDraft(login string, id int, lang, mode string) (code string, path string, ok bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	dm := s.draftsByUser[login]
	if dm == nil {
		return "", "", false
	}
	c, exists := dm[draftMapKey(id, lang, mode)]
	if !exists {
		return "", "", false
	}
	prob := s.problems[id]
	return c, progress.DraftPath(prob, lang, mode), true
}

func (s *HotStore) SavePractice(login, repo, sealedToken string, save progress.PracticeSave, now time.Time) (PracticeSaveResponse, error) {
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

func (s *HotStore) enqueueOutboxLocked(login, repo, sealedToken, filePath, content, commitMsg string, now time.Time) {
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

// PendingBatchForNextUser fetches all ready unsynced outbox items for one user repo.
func (s *HotStore) PendingBatchForNextUser(now time.Time) (login, repo, sealedToken string, items []OutboxItem) {
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
			sealedToken = it.TokenSealed // always use freshest token
			items = append(items, *it)
		}
	}
	return login, repo, sealedToken, items
}

func (s *HotStore) MarkOutboxSynced(ids []int64, commitSHA string, now time.Time) {
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
}

func (s *HotStore) MarkOutboxRetry(ids []int64, errStr string, backoff time.Duration, now time.Time) {
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
}

func (s *HotStore) OutboxCounts() (pending, synced int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, it := range s.outbox {
		if it.SyncedAt.IsZero() {
			pending++
		} else {
			synced++
		}
	}
	return pending, synced
}

type storeSnapshot struct {
	Progress  map[string]map[string]progress.ProgressEntry `json:"progress"`
	Settings  map[string][]string                          `json:"settings"`
	Drafts    map[string]map[string]string                 `json:"drafts"`
	Paths     map[string]map[string]struct{}               `json:"paths"`
	Solutions map[string]map[string]string                 `json:"solutions"`
	Outbox    []*OutboxItem                                `json:"outbox"`
	NextID    int64                                        `json:"nextId"`
}

func (s *HotStore) persistSnapshotLocked() {
	if s.snapshotFile == "" {
		return
	}
	b, err := json.Marshal(storeSnapshot{
		Progress:  s.progressByUser,
		Settings:  s.settingsByUser,
		Drafts:    s.draftsByUser,
		Paths:     s.pathsByUser,
		Solutions: s.solutionsByUser,
		Outbox:    s.outbox,
		NextID:    s.nextOutboxID,
	})
	if err == nil {
		_ = os.WriteFile(s.snapshotFile, b, 0o600)
	}
}

func (s *HotStore) loadSnapshot() {
	raw, err := os.ReadFile(s.snapshotFile)
	if err != nil {
		return
	}
	var snap storeSnapshot
	if json.Unmarshal(raw, &snap) == nil {
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
		s.outbox = snap.Outbox
		if snap.NextID > 0 {
			s.nextOutboxID = snap.NextID
		}
	}
}
