-- External identity mappings for Google and Sign in with Apple.
-- These are keyed by the immutable provider subject, never an email address.

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_identities_provider_check
        CHECK (provider IN ('google', 'apple')),
    CONSTRAINT oauth_identities_subject_not_blank
        CHECK (length(btrim(provider_subject)) > 0),
    CONSTRAINT oauth_identities_provider_subject_unique
        UNIQUE (provider, provider_subject),
    CONSTRAINT oauth_identities_one_provider_per_user
        UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user
    ON oauth_identities (user_id);

CREATE TABLE IF NOT EXISTS oauth_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(16) NOT NULL,
    nonce_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_challenges_provider_check
        CHECK (provider IN ('google', 'apple')),
    CONSTRAINT oauth_challenges_expiry_check
        CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_oauth_challenges_expiry
    ON oauth_challenges (expires_at)
    WHERE used_at IS NULL;
