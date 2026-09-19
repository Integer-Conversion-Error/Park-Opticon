-- Mobile report lifecycle and user preferences.
-- This migration deliberately uses portable PostgreSQL/PostGIS primitives so it
-- can be moved into a Supabase migration later without Go-specific behavior.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notification_radius_meters INTEGER,
    ADD COLUMN IF NOT EXISTS ask_about_enforcement_after_parking BOOLEAN,
    ADD COLUMN IF NOT EXISTS announce_open_spot_after_unparking BOOLEAN;

UPDATE users
SET notification_radius_meters = LEAST(
        2500,
        GREATEST(100, COALESCE(ROUND(parking_radius_miles * 1609.34), 1000)::INTEGER)
    )
WHERE notification_radius_meters IS NULL;

UPDATE users
SET ask_about_enforcement_after_parking = true
WHERE ask_about_enforcement_after_parking IS NULL;

UPDATE users
SET announce_open_spot_after_unparking = true
WHERE announce_open_spot_after_unparking IS NULL;

ALTER TABLE users
    ALTER COLUMN notification_radius_meters SET DEFAULT 1000,
    ALTER COLUMN notification_radius_meters SET NOT NULL,
    ALTER COLUMN ask_about_enforcement_after_parking SET DEFAULT true,
    ALTER COLUMN ask_about_enforcement_after_parking SET NOT NULL,
    ALTER COLUMN announce_open_spot_after_unparking SET DEFAULT true,
    ALTER COLUMN announce_open_spot_after_unparking SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_notification_radius_check'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_notification_radius_check
            CHECK (notification_radius_meters BETWEEN 100 AND 2500);
    END IF;
END $$;

ALTER TABLE parking_spots
    ADD COLUMN IF NOT EXISTS report_source TEXT,
    ADD COLUMN IF NOT EXISTS stale_at TIMESTAMP WITH TIME ZONE;

UPDATE parking_spots
SET report_source = 'community'
WHERE report_source IS NULL;

ALTER TABLE parking_spots
    ALTER COLUMN report_source SET DEFAULT 'community',
    ALTER COLUMN report_source SET NOT NULL;

UPDATE parking_spots
SET stale_at = created_at + INTERVAL '5 minutes'
WHERE report_source = 'user_unpark' AND stale_at IS NULL;

ALTER TABLE parking_spots DROP CONSTRAINT IF EXISTS parking_spots_status_check;
ALTER TABLE parking_spots
    ADD CONSTRAINT parking_spots_status_check
    CHECK (status IN ('available', 'occupied', 'unknown', 'taken', 'expired'));

ALTER TABLE parking_spots DROP CONSTRAINT IF EXISTS parking_spots_spot_type_check;
ALTER TABLE parking_spots
    ADD CONSTRAINT parking_spots_spot_type_check
    CHECK (spot_type IS NULL OR spot_type IN ('street', 'garage', 'lot', 'private', 'open_spot'));

ALTER TABLE parking_spots DROP CONSTRAINT IF EXISTS parking_spots_source_check;
ALTER TABLE parking_spots
    ADD CONSTRAINT parking_spots_source_check
    CHECK (report_source IN ('community', 'user_unpark', 'admin', 'system'));

CREATE INDEX IF NOT EXISTS idx_users_alert_preferences
    ON users (enforcement_alerts_enabled, notification_radius_meters)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_parking_spots_active_nearby
    ON parking_spots (status, expires_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enforcement_alerts_active_nearby
    ON enforcement_alerts (status, expires_at, created_at DESC);

ALTER TABLE verifications DROP CONSTRAINT IF EXISTS verifications_type_check;
ALTER TABLE verifications DROP CONSTRAINT IF EXISTS verifications_verification_type_check;
ALTER TABLE verifications
    ADD CONSTRAINT verifications_type_check
    CHECK (verification_type IN ('confirm', 'deny'));

ALTER TABLE verifications DROP CONSTRAINT IF EXISTS verifications_target_type_check;
ALTER TABLE verifications DROP CONSTRAINT IF EXISTS verifications_verifiable_type_check;
ALTER TABLE verifications
    ADD CONSTRAINT verifications_target_type_check
    CHECK (verifiable_type IN ('parking_spot', 'enforcement_alert'));

CREATE INDEX IF NOT EXISTS idx_verifications_target_created
    ON verifications (verifiable_type, verifiable_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

-- Older bootstrap installs allowed one row per verification type. The API
-- intentionally models one current vote per user/report, so collapse any
-- legacy duplicates before enforcing that invariant everywhere.
DELETE FROM verifications older
USING (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, verifiable_type, verifiable_id
               ORDER BY created_at DESC, id DESC
           ) AS row_number
    FROM verifications
) ranked
WHERE older.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_verifications_one_vote_per_target
    ON verifications (user_id, verifiable_type, verifiable_id);

CREATE TABLE IF NOT EXISTS parking_session_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES parking_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    saw_enforcement BOOLEAN NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT parking_session_feedback_one_per_session UNIQUE (session_id),
    CONSTRAINT parking_session_feedback_coordinates_check CHECK (
        latitude >= -90 AND latitude <= 90 AND
        longitude >= -180 AND longitude <= 180
    )
);

CREATE INDEX IF NOT EXISTS idx_parking_session_feedback_user_created
    ON parking_session_feedback (user_id, created_at DESC);
