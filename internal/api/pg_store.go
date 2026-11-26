package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/Hanwen-Jiang/coding-dance/internal/progress"
)

// PostgresStore is the zero-CGO PostgreSQL backing store for cd-api hot storage and git_sync_outbox.
type PostgresStore struct {
	db       *sql.DB
	problems map[int]progress.ProblemMeta
}

func NewPostgresStore(ctx context.Context, dsn string, problems []progress.ProblemMeta) (*PostgresStore, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(16)
	db.SetMaxIdleConns(8)
	db.SetConnMaxLifetime(30 * time.Minute)
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	pm := make(map[int]progress.ProblemMeta, len(problems))
	for _, p := range problems {
		pm[p.ID] = p
	}
	ps := &PostgresStore{db: db, problems: pm}
	if err := ps.EnsureSchema(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return ps, nil
}

func (s *PostgresStore) EnsureSchema(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, PostgresMigrationSQL)
	return err
}

func (s *PostgresStore) Problem(id int) (progress.ProblemMeta, bool) {
	p, ok := s.problems[id]
	return p, ok
}

func (s *PostgresStore) Close() error {
	return s.db.Close()
}

func (s *PostgresStore) UpsertProfile(ctx context.Context, p UserProfile) error {
	var ghCreated sql.NullTime
	if p.GHCreatedAt != "" {
		if t, err := time.Parse(time.RFC3339, p.GHCreatedAt); err == nil {
			ghCreated = sql.NullTime{Time: t, Valid: true}
		}
	}
	tier := p.Tier
	if tier == "" {
		tier = "free"
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO user_profiles (login, avatar_url, tier, founder, gh_created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (login) DO UPDATE SET
			avatar_url = CASE WHEN EXCLUDED.avatar_url <> '' THEN EXCLUDED.avatar_url ELSE user_profiles.avatar_url END,
			tier = EXCLUDED.tier,
			founder = EXCLUDED.founder,
			gh_created_at = COALESCE(EXCLUDED.gh_created_at, user_profiles.gh_created_at),
			updated_at = NOW()
	`, p.Login, p.AvatarURL, tier, p.Founder, ghCreated)
	return err
}

func (s *PostgresStore) GetProfile(ctx context.Context, login string) (UserProfile, bool, error) {
	var p UserProfile
	var ghCreated sql.NullTime
	var repoSynced sql.NullTime
	err := s.db.QueryRowContext(ctx, `
		SELECT login, avatar_url, tier, founder, gh_created_at, repo_synced_at
		FROM user_profiles WHERE login = $1
	`, login).Scan(&p.Login, &p.AvatarURL, &p.Tier, &p.Founder, &ghCreated, &repoSynced)
	if err == sql.ErrNoRows {
		return UserProfile{}, false, nil
	}
	if err != nil {
		return UserProfile{}, false, err
	}
	if ghCreated.Valid {
		p.GHCreatedAt = ghCreated.Time.UTC().Format(time.RFC3339)
	}
	p.RepoSynced = repoSynced.Valid
	return p, true, nil
}

func (s *PostgresStore) IsHydrated(ctx context.Context, login string) (bool, error) {
	var synced sql.NullTime
	err := s.db.QueryRowContext(ctx, `SELECT repo_synced_at FROM user_profiles WHERE login = $1`, login).Scan(&synced)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return synced.Valid, nil
}

func (s *PostgresStore) ReplaceFromHydration(ctx context.Context, login string, data HydratedRepo, now time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO user_profiles (login, repo_synced_at, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (login) DO UPDATE SET repo_synced_at = EXCLUDED.repo_synced_at, updated_at = NOW()
	`, login, now); err != nil {
		return err
	}

	for _, tbl := range []string{"problem_progress", "user_settings", "practice_drafts", "practice_attempts", "user_solutions", "user_repo_paths"} {
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+tbl+" WHERE login = $1", login); err != nil {
			return err
		}
	}

	for idStr, pe := range data.Progress {
		pid, err := strconv.Atoi(idStr)
		if err != nil || !slices.Contains(progress.ValidStatuses, pe.Status) || pe.Status == "未开始" {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO problem_progress (login, problem_id, status, updated_date, updated_at)
			VALUES ($1, $2, $3, $4, NOW())
		`, login, pid, pe.Status, pe.UpdatedAt); err != nil {
			return err
		}
	}

	if len(data.Settings) > 0 {
		raw, _ := json.Marshal(data.Settings)
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO user_settings (login, langs, updated_at) VALUES ($1, $2::jsonb, NOW())
		`, login, string(raw)); err != nil {
			return err
		}
	}

	for _, d := range data.Drafts {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO practice_drafts (login, problem_id, lang, mode, file_path, code, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
			ON CONFLICT (login, problem_id, lang, mode) DO UPDATE SET file_path = EXCLUDED.file_path, code = EXCLUDED.code, updated_at = NOW()
		`, login, d.ProblemID, d.Lang, d.Mode, d.FilePath, d.Code); err != nil {
			return err
		}
	}

	for _, sol := range data.Solutions {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO user_solutions (login, file_path, problem_id, lang, code_key, code, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
			ON CONFLICT (login, file_path) DO UPDATE SET code_key = EXCLUDED.code_key, code = EXCLUDED.code, updated_at = NOW()
		`, login, sol.FilePath, sol.ProblemID, sol.Lang, progress.CodeKey(sol.Code), sol.Code); err != nil {
			return err
		}
	}

	for _, att := range data.Attempts {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO practice_attempts (login, problem_id, date_bj, seq, result, lang, mode, file_path, markdown)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (login, file_path) DO UPDATE SET markdown = EXCLUDED.markdown
		`, login, att.ProblemID, att.Date, att.Seq, att.Result, att.Lang, att.Mode, att.FilePath, att.Markdown); err != nil {
			return err
		}
	}

	for _, p := range data.AllPaths {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO user_repo_paths (login, file_path) VALUES ($1, $2) ON CONFLICT DO NOTHING
		`, login, p); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *PostgresStore) LoadOverview(ctx context.Context, login string) (ProgressOverview, error) {
	statusOut := make(map[string]string)
	rows, err := s.db.QueryContext(ctx, `SELECT problem_id, status FROM problem_progress WHERE login = $1`, login)
	if err != nil {
		return ProgressOverview{}, err
	}
	for rows.Next() {
		var pid int
		var st string
		if err := rows.Scan(&pid, &st); err != nil {
			_ = rows.Close()
			return ProgressOverview{}, err
		}
		if slices.Contains(progress.ValidStatuses, st) && st != "未开始" {
			statusOut[strconv.Itoa(pid)] = st
		}
	}
	if err := rows.Close(); err != nil {
		return ProgressOverview{}, err
	}

	langsOut := make(map[string][]string)
	sRows, err := s.db.QueryContext(ctx, `SELECT problem_id, lang FROM user_solutions WHERE login = $1 ORDER BY problem_id, file_path`, login)
	if err != nil {
		return ProgressOverview{}, err
	}
	for sRows.Next() {
		var pid int
		var lang string
		if err := sRows.Scan(&pid, &lang); err != nil {
			_ = sRows.Close()
			return ProgressOverview{}, err
		}
		k := strconv.Itoa(pid)
		if !slices.Contains(langsOut[k], lang) {
			langsOut[k] = append(langsOut[k], lang)
		}
	}
	if err := sRows.Close(); err != nil {
		return ProgressOverview{}, err
	}

	var settings map[string]any
	var langsRaw string
	err = s.db.QueryRowContext(ctx, `SELECT langs::text FROM user_settings WHERE login = $1`, login).Scan(&langsRaw)
	if err == nil {
		var langs []string
		if json.Unmarshal([]byte(langsRaw), &langs) == nil && len(langs) > 0 {
			settings = map[string]any{"langs": langs}
		}
	} else if err != sql.ErrNoRows {
		return ProgressOverview{}, err
	}

	return ProgressOverview{Status: statusOut, Langs: langsOut, Settings: settings}, nil
}

func (s *PostgresStore) SaveStatus(ctx context.Context, login, repo, sealedToken string, id int, status string, now time.Time) (ProgressOverview, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ProgressOverview{}, err
	}
	defer func() { _ = tx.Rollback() }()

	if status == "未开始" {
		if _, err := tx.ExecContext(ctx, `DELETE FROM problem_progress WHERE login = $1 AND problem_id = $2`, login, id); err != nil {
			return ProgressOverview{}, err
		}
	} else {
		bjDate, _ := progress.BeijingParts(now)
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO problem_progress (login, problem_id, status, updated_date, updated_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (login, problem_id) DO UPDATE SET status = EXCLUDED.status, updated_date = EXCLUDED.updated_date, updated_at = NOW()
		`, login, id, status, bjDate); err != nil {
			return ProgressOverview{}, err
		}
	}

	progMap, err := loadProgressMapTx(ctx, tx, login)
	if err != nil {
		return ProgressOverview{}, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO user_repo_paths (login, file_path) VALUES ($1, 'progress.json') ON CONFLICT DO NOTHING`, login); err != nil {
		return ProgressOverview{}, err
	}
	progContent := progress.WriteProgressJSON(progMap)
	if err := insertOutboxTx(ctx, tx, login, repo, sealedToken, "progress.json", progContent, fmt.Sprintf("进度：第 %d 题 → %s", id, status), now); err != nil {
		return ProgressOverview{}, err
	}
	if err := tx.Commit(); err != nil {
		return ProgressOverview{}, err
	}
	return s.LoadOverview(ctx, login)
}

func (s *PostgresStore) SaveSettings(ctx context.Context, login, repo, sealedToken string, langs []string, now time.Time) ([]string, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	raw, _ := json.Marshal(langs)
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO user_settings (login, langs, updated_at) VALUES ($1, $2::jsonb, NOW())
		ON CONFLICT (login) DO UPDATE SET langs = EXCLUDED.langs, updated_at = NOW()
	`, login, string(raw)); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO user_repo_paths (login, file_path) VALUES ($1, 'settings.json') ON CONFLICT DO NOTHING`, login); err != nil {
		return nil, err
	}
	labels := make([]string, len(langs))
	for i, l := range langs {
		if lbl, ok := progress.LangLabel[l]; ok {
			labels[i] = lbl
		} else {
			labels[i] = l
		}
	}
	msg := "设置：常用语言 → " + joinStr(labels, "、")
	if err := insertOutboxTx(ctx, tx, login, repo, sealedToken, "settings.json", progress.WriteSettingsJSON(langs), msg, now); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return langs, nil
}

func (s *PostgresStore) GetDraft(ctx context.Context, login string, id int, lang, mode string) (string, string, bool, error) {
	var code, path string
	err := s.db.QueryRowContext(ctx, `
		SELECT code, file_path FROM practice_drafts
		WHERE login = $1 AND problem_id = $2 AND lang = $3 AND mode = $4
	`, login, id, lang, mode).Scan(&code, &path)
	if err == sql.ErrNoRows {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}
	return code, path, true, nil
}

func (s *PostgresStore) SavePractice(ctx context.Context, login, repo, sealedToken string, save progress.PracticeSave, now time.Time) (PracticeSaveResponse, error) {
	prob, exists := s.problems[save.ID]
	if !exists {
		return PracticeSaveResponse{}, &progress.ValidationError{Message: "这道题不在热题 100 题库里", Status: 404}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return PracticeSaveResponse{}, err
	}
	defer func() { _ = tx.Rollback() }()

	if save.Kind == "draft" {
		tidy := progress.TidyCode(save.Code)
		dp := progress.DraftPath(prob, save.Lang, save.Mode)
		var prev string
		err := tx.QueryRowContext(ctx, `
			SELECT code FROM practice_drafts WHERE login = $1 AND problem_id = $2 AND lang = $3 AND mode = $4
		`, login, save.ID, save.Lang, save.Mode).Scan(&prev)
		if err == nil && prev == tidy {
			return PracticeSaveResponse{Saved: false, Queued: false, Files: []string{}, Draft: dp}, nil
		}
		if err != nil && err != sql.ErrNoRows {
			return PracticeSaveResponse{}, err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO practice_drafts (login, problem_id, lang, mode, file_path, code, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
			ON CONFLICT (login, problem_id, lang, mode) DO UPDATE SET file_path = EXCLUDED.file_path, code = EXCLUDED.code, updated_at = NOW()
		`, login, save.ID, save.Lang, save.Mode, dp, tidy); err != nil {
			return PracticeSaveResponse{}, err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO user_repo_paths (login, file_path) VALUES ($1, $2) ON CONFLICT DO NOTHING`, login, dp); err != nil {
			return PracticeSaveResponse{}, err
		}
		plan, _ := progress.PlanPracticeSave(save, progress.PlanContext{Problem: prob, Now: now})
		if err := insertOutboxTx(ctx, tx, login, repo, sealedToken, dp, tidy, plan.Message, now); err != nil {
			return PracticeSaveResponse{}, err
		}
		if err := tx.Commit(); err != nil {
			return PracticeSaveResponse{}, err
		}
		return PracticeSaveResponse{Saved: true, Queued: true, Files: []string{dp}, Draft: dp}, nil
	}

	paths, err := loadPathsTx(ctx, tx, login)
	if err != nil {
		return PracticeSaveResponse{}, err
	}
	progMap, err := loadProgressMapTx(ctx, tx, login)
	if err != nil {
		return PracticeSaveResponse{}, err
	}
	solMap, err := loadProblemLangSolutionsTx(ctx, tx, login, save.ID, save.Lang)
	if err != nil {
		return PracticeSaveResponse{}, err
	}

	plan, err := progress.PlanPracticeSave(save, progress.PlanContext{
		Problem:           prob,
		ExistingPaths:     paths,
		Progress:          progMap,
		ExistingSolutions: solMap,
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
	bjDate, _ := progress.BeijingParts(now)
	for _, f := range plan.Files {
		fileNames = append(fileNames, f.Path)
		if _, err := tx.ExecContext(ctx, `INSERT INTO user_repo_paths (login, file_path) VALUES ($1, $2) ON CONFLICT DO NOTHING`, login, f.Path); err != nil {
			return PracticeSaveResponse{}, err
		}
		if f.Path == plan.Solution {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO user_solutions (login, file_path, problem_id, lang, code_key, code, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, NOW())
				ON CONFLICT (login, file_path) DO UPDATE SET code_key = EXCLUDED.code_key, code = EXCLUDED.code, updated_at = NOW()
			`, login, f.Path, save.ID, save.Lang, progress.CodeKey(f.Content), f.Content); err != nil {
				return PracticeSaveResponse{}, err
			}
		}
		if f.Path == plan.Attempt {
			_, dStr, seq, resStr, _ := progress.ParseAttemptPath(f.Path)
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO practice_attempts (login, problem_id, date_bj, seq, result, lang, mode, file_path, markdown)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				ON CONFLICT (login, file_path) DO UPDATE SET markdown = EXCLUDED.markdown
			`, login, save.ID, dStr, seq, resStr, save.Lang, save.Mode, f.Path, f.Content); err != nil {
				return PracticeSaveResponse{}, err
			}
		}
		if f.Path == "progress.json" && plan.Status != "" {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO problem_progress (login, problem_id, status, updated_date, updated_at)
				VALUES ($1, $2, $3, $4, NOW())
				ON CONFLICT (login, problem_id) DO UPDATE SET status = EXCLUDED.status, updated_date = EXCLUDED.updated_date, updated_at = NOW()
			`, login, save.ID, plan.Status, bjDate); err != nil {
				return PracticeSaveResponse{}, err
			}
		}
		if err := insertOutboxTx(ctx, tx, login, repo, sealedToken, f.Path, f.Content, plan.Message, now); err != nil {
			return PracticeSaveResponse{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return PracticeSaveResponse{}, err
	}
	return PracticeSaveResponse{
		Saved:    true,
		Queued:   true,
		Files:    fileNames,
		Attempt:  plan.Attempt,
		Solution: plan.Solution,
		Status:   plan.Status,
	}, nil
}

func (s *PostgresStore) LoadProblemHistory(ctx context.Context, login string, id int) (ProblemHistoryResponse, error) {
	sols := make(map[string]string)
	sRows, err := s.db.QueryContext(ctx, `SELECT file_path, code FROM user_solutions WHERE login = $1 AND problem_id = $2`, login, id)
	if err != nil {
		return ProblemHistoryResponse{}, err
	}
	for sRows.Next() {
		var p, c string
		if err := sRows.Scan(&p, &c); err != nil {
			_ = sRows.Close()
			return ProblemHistoryResponse{}, err
		}
		sols[p] = c
	}
	if err := sRows.Close(); err != nil {
		return ProblemHistoryResponse{}, err
	}

	atts := make(map[string]string)
	aRows, err := s.db.QueryContext(ctx, `SELECT file_path, markdown FROM practice_attempts WHERE login = $1 AND problem_id = $2`, login, id)
	if err != nil {
		return ProblemHistoryResponse{}, err
	}
	for aRows.Next() {
		var p, md string
		if err := aRows.Scan(&p, &md); err != nil {
			_ = aRows.Close()
			return ProblemHistoryResponse{}, err
		}
		atts[p] = md
	}
	if err := aRows.Close(); err != nil {
		return ProblemHistoryResponse{}, err
	}

	return buildProblemHistory(id, sols, atts), nil
}

func (s *PostgresStore) PendingBatchForNextUser(ctx context.Context, now time.Time) (login, repo, sealedToken string, items []OutboxItem, err error) {
	err = s.db.QueryRowContext(ctx, `
		SELECT login, repo FROM git_sync_outbox
		WHERE synced_at IS NULL AND next_retry_at <= $1
		ORDER BY id ASC LIMIT 1
	`, now).Scan(&login, &repo)
	if err == sql.ErrNoRows {
		return "", "", "", nil, nil
	}
	if err != nil {
		return "", "", "", nil, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, login, repo, gh_token_seal, file_path, content, commit_msg, created_at, next_retry_at, attempts, COALESCE(last_error, '')
		FROM git_sync_outbox
		WHERE synced_at IS NULL AND next_retry_at <= $1 AND login = $2 AND repo = $3
		ORDER BY id ASC
	`, now, login, repo)
	if err != nil {
		return "", "", "", nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it OutboxItem
		if err := rows.Scan(&it.ID, &it.Login, &it.Repo, &it.TokenSealed, &it.FilePath, &it.Content, &it.CommitMsg, &it.CreatedAt, &it.NextRetryAt, &it.Attempts, &it.LastError); err != nil {
			return "", "", "", nil, err
		}
		sealedToken = it.TokenSealed
		items = append(items, it)
	}
	return login, repo, sealedToken, items, rows.Err()
}

func (s *PostgresStore) MarkOutboxSynced(ctx context.Context, ids []int64, commitSHA string, now time.Time) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `
		UPDATE git_sync_outbox
		SET synced_at = $1, synced_commit = $2, last_error = NULL
		WHERE id = ANY($3)
	`, now, commitSHA, ids)
	return err
}

func (s *PostgresStore) MarkOutboxRetry(ctx context.Context, ids []int64, errStr string, backoff time.Duration, now time.Time) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `
		UPDATE git_sync_outbox
		SET attempts = attempts + 1, last_error = $1, next_retry_at = $2
		WHERE id = ANY($3)
	`, errStr, now.Add(backoff), ids)
	return err
}

func (s *PostgresStore) OutboxCounts(ctx context.Context) (pending, synced int, err error) {
	err = s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE synced_at IS NULL),
			COUNT(*) FILTER (WHERE synced_at IS NOT NULL)
		FROM git_sync_outbox
	`).Scan(&pending, &synced)
	return pending, synced, err
}

func insertOutboxTx(ctx context.Context, tx *sql.Tx, login, repo, sealedToken, filePath, content, commitMsg string, now time.Time) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO git_sync_outbox (login, repo, gh_token_seal, file_path, content, commit_msg, created_at, next_retry_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
	`, login, repo, sealedToken, filePath, content, commitMsg, now)
	return err
}

func loadProgressMapTx(ctx context.Context, tx *sql.Tx, login string) (map[string]progress.ProgressEntry, error) {
	rows, err := tx.QueryContext(ctx, `SELECT problem_id, status, updated_date FROM problem_progress WHERE login = $1`, login)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]progress.ProgressEntry)
	for rows.Next() {
		var pid int
		var st, dt string
		if err := rows.Scan(&pid, &st, &dt); err != nil {
			return nil, err
		}
		out[strconv.Itoa(pid)] = progress.ProgressEntry{Status: st, UpdatedAt: dt}
	}
	return out, rows.Err()
}

func loadPathsTx(ctx context.Context, tx *sql.Tx, login string) ([]string, error) {
	rows, err := tx.QueryContext(ctx, `SELECT file_path FROM user_repo_paths WHERE login = $1 ORDER BY file_path`, login)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func loadProblemLangSolutionsTx(ctx context.Context, tx *sql.Tx, login string, id int, lang string) (map[string]string, error) {
	rows, err := tx.QueryContext(ctx, `SELECT file_path, code FROM user_solutions WHERE login = $1 AND problem_id = $2 AND lang = $3`, login, id, lang)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]string)
	for rows.Next() {
		var p, c string
		if err := rows.Scan(&p, &c); err != nil {
			return nil, err
		}
		out[p] = c
	}
	return out, rows.Err()
}
