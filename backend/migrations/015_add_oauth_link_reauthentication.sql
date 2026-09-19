-- A one-time proof issued after fresh password/linked-provider (and, when
-- enabled, MFA) verification. It is consumed in the account-link transaction.

CREATE TABLE IF NOT EXISTS oauth_link_reauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_link_reauth_tokens_expiry_check
        CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_oauth_link_reauth_tokens_user_expiry
    ON oauth_link_reauth_tokens (user_id, expires_at)
    WHERE used_at IS NULL;
