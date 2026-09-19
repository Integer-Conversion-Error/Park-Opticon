-- Remove the legacy plaintext refresh-token material after migration 008
-- populated refresh_token_hash.
UPDATE user_sessions
SET refresh_token = NULL
WHERE refresh_token IS NOT NULL AND refresh_token_hash IS NOT NULL;

DROP INDEX IF EXISTS idx_sessions_token;
