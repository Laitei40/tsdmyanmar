-- 0001_admin_auth.sql
-- Adds admin_users / admin_sessions for the self-built Admin/Editor auth system
-- that replaces Cloudflare Access.
--
-- ADDITIVE ONLY — safe to run once against production. Do NOT add this to
-- schema.sql (that file DROPs and recreates the news tables from scratch).
--
-- Local:  wrangler d1 execute tsd_updates --local  --persist-to .wrangler/state --file=scripts/admin/migrations/0001_admin_auth.sql
-- Remote: wrangler d1 execute tsd_updates --remote --file=scripts/admin/migrations/0001_admin_auth.sql
-- (run from the repo root, where wrangler.toml lives)

CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,             -- pbkdf2$<iterations>$<saltB64>$<hashB64>
  role TEXT NOT NULL CHECK (role IN ('admin','editor')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,                        -- NULL = not locked; ISO datetime otherwise
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
CREATE UNIQUE INDEX idx_admin_users_email ON admin_users(email);

-- D1/SQLite does not enforce FOREIGN KEY constraints — deleting a user must
-- explicitly delete their sessions too (see destroyAllSessionsForUser in
-- admin/_lib/auth.js and the users/[id].js DELETE handler).
CREATE TABLE admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,          -- SHA-256 of the raw cookie token; raw token never stored
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- Seed: first Admin account. Temporary password was generated once, hashed
-- below, and shown to the user directly (never committed in plaintext).
-- must_change_password=1 forces a password change on first login.
INSERT INTO admin_users (name, email, password_hash, role, must_change_password)
VALUES (
  'Laitei',
  'laitei@tsdmyanmar.org',
  'pbkdf2$100000$vmHKayjuLQ1fEc32tnBcag==$mxvEfhRMf6iL/q1+SHSbry0CP4vT5AY3g/wAsAK2Rw8=',
  'admin',
  1
);
