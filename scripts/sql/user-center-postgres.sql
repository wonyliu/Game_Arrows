CREATE SEQUENCE IF NOT EXISTS user_center_user_seq START 1;
CREATE SEQUENCE IF NOT EXISTS user_center_temp_seq START 1;

CREATE TABLE IF NOT EXISTS user_center_users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_lower TEXT NOT NULL UNIQUE,
    avatar_url TEXT NOT NULL,
    is_temp_user BOOLEAN NOT NULL DEFAULT FALSE,
    password_algorithm TEXT NOT NULL DEFAULT 'sha256-v1',
    password_salt TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    last_active_at TIMESTAMPTZ NOT NULL,
    primary_device_id TEXT NOT NULL DEFAULT '',
    hardware_device_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    devices JSONB NOT NULL DEFAULT '[]'::jsonb,
    cookie_device_mismatch_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    progress JSONB NOT NULL,
    liveops_player JSONB NOT NULL,
    coins INTEGER NOT NULL DEFAULT 0,
    max_unlocked_level INTEGER NOT NULL DEFAULT 1,
    max_cleared_level INTEGER NOT NULL DEFAULT 0,
    unlocked_skin_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_center_users
    ADD COLUMN IF NOT EXISTS password_algorithm TEXT NOT NULL DEFAULT 'sha256-v1';

CREATE INDEX IF NOT EXISTS idx_user_center_username_lower
ON user_center_users (username_lower);

CREATE INDEX IF NOT EXISTS idx_user_center_leaderboard
ON user_center_users (max_cleared_level DESC, coins DESC, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_center_last_active
ON user_center_users (last_active_at DESC);
