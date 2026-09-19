-- Security hardening: MFA state, hashed refresh sessions, and one-time account tokens.

-- The runtime migration path creates this table before applying this hardening
-- step. The standalone bootstrap path starts from 001_schema.sql, which did
-- not include it, so create the final-compatible base table here as well.
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT,
    refresh_token_hash TEXT,
    token_family_id UUID DEFAULT gen_random_uuid(),
    replaced_by_session_id UUID,
    device_info TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS mfa_secret_encrypted BYTEA,
    ADD COLUMN IF NOT EXISTS mfa_confirmed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_sessions
    ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS token_family_id UUID,
    ADD COLUMN IF NOT EXISTS replaced_by_session_id UUID;

UPDATE user_sessions
SET refresh_token_hash = encode(digest(refresh_token, 'sha256'), 'hex')
WHERE refresh_token_hash IS NULL AND refresh_token IS NOT NULL;

UPDATE user_sessions
SET token_family_id = gen_random_uuid()
WHERE token_family_id IS NULL;

UPDATE user_sessions
SET refresh_token = NULL
WHERE refresh_token IS NOT NULL AND refresh_token_hash IS NOT NULL;

DROP INDEX IF EXISTS idx_sessions_token;

ALTER TABLE user_sessions
    ALTER COLUMN refresh_token DROP NOT NULL,
    ALTER COLUMN token_family_id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN token_family_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_refresh_token_hash
    ON user_sessions (refresh_token_hash)
    WHERE refresh_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_family
    ON user_sessions (user_id, token_family_id, revoked_at);

CREATE TABLE IF NOT EXISTS account_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_type VARCHAR(32) NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT account_tokens_type_check CHECK (token_type IN ('email_verification', 'password_reset'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_tokens_hash
    ON account_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_account_tokens_user_type
    ON account_tokens (user_id, token_type, created_at DESC);

CREATE TABLE IF NOT EXISTS user_mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mfa_recovery_code_hash
    ON user_mfa_recovery_codes (code_hash);
CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_codes_user
    ON user_mfa_recovery_codes (user_id, used_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_security_events
    ON audit_logs (action, created_at DESC);
