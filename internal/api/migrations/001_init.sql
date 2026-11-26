-- Phase 2: cd-api PostgreSQL Hot Storage & Transactional Git Sync Outbox Schema
-- Guarantees <5ms OLTP reads/writes while asynchronously batching commits back to <user>/hot100-progress.

CREATE TABLE IF NOT EXISTS user_profiles (
    login          TEXT PRIMARY KEY,
    avatar_url     TEXT NOT NULL DEFAULT '',
    tier           TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro'
    founder        BOOLEAN NOT NULL DEFAULT FALSE,
    gh_created_at  TIMESTAMPTZ,
    repo_synced_at TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS repo_synced_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS problem_progress (
    login          TEXT NOT NULL,
    problem_id     INTEGER NOT NULL,
    status         TEXT NOT NULL, -- '已通过' | '曾通过' | '尝试过'
    updated_date   TEXT NOT NULL DEFAULT '', -- YYYY-MM-DD (Beijing)
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (login, problem_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
    login          TEXT PRIMARY KEY,
    langs          JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS practice_drafts (
    login          TEXT NOT NULL,
    problem_id     INTEGER NOT NULL,
    lang           TEXT NOT NULL,
    mode           TEXT NOT NULL, -- 'leetcode' | 'acm'
    file_path      TEXT NOT NULL,
    code           TEXT NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (login, problem_id, lang, mode)
);

CREATE TABLE IF NOT EXISTS practice_attempts (
    id             BIGSERIAL PRIMARY KEY,
    login          TEXT NOT NULL,
    problem_id     INTEGER NOT NULL,
    date_bj        TEXT NOT NULL,
    seq            INTEGER NOT NULL,
    result         TEXT NOT NULL,
    lang           TEXT NOT NULL,
    mode           TEXT NOT NULL,
    file_path      TEXT NOT NULL,
    markdown       TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (login, file_path)
);
ALTER TABLE practice_attempts DROP CONSTRAINT IF EXISTS practice_attempts_file_path_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'practice_attempts_login_file_path_key'
    ) THEN
        ALTER TABLE practice_attempts ADD CONSTRAINT practice_attempts_login_file_path_key UNIQUE (login, file_path);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_problem ON practice_attempts (login, problem_id, date_bj, seq);

CREATE TABLE IF NOT EXISTS user_solutions (
    login          TEXT NOT NULL,
    file_path      TEXT NOT NULL,
    problem_id     INTEGER NOT NULL,
    lang           TEXT NOT NULL,
    code_key       TEXT NOT NULL,
    code           TEXT NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (login, file_path)
);
CREATE INDEX IF NOT EXISTS idx_user_solutions_lookup ON user_solutions (login, problem_id, lang);

CREATE TABLE IF NOT EXISTS user_repo_paths (
    login          TEXT NOT NULL,
    file_path      TEXT NOT NULL,
    PRIMARY KEY (login, file_path)
);

CREATE TABLE IF NOT EXISTS git_sync_outbox (
    id             BIGSERIAL PRIMARY KEY,
    login          TEXT NOT NULL,
    repo           TEXT NOT NULL,
    gh_token_seal  TEXT NOT NULL, -- Sealed with SESSION_SECRET (AES-256-GCM)
    file_path      TEXT NOT NULL,
    content        TEXT NOT NULL,
    commit_msg     TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_retry_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at      TIMESTAMPTZ,
    synced_commit  TEXT,
    attempts       INTEGER NOT NULL DEFAULT 0,
    last_error     TEXT
);
CREATE INDEX IF NOT EXISTS idx_git_sync_outbox_pending
    ON git_sync_outbox (next_retry_at, login)
    WHERE synced_at IS NULL;
