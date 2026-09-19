-- Migration 006: enforce invariants required by the focused parking MVP.
-- This file is idempotent so it can be used by the fresh-install script.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_sessions_one_active_user
    ON parking_sessions (user_id)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_parking_sessions_vehicle
    ON parking_sessions (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_enforcement_alerts_reporter
    ON enforcement_alerts (reporter_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_one_related_event
    ON notifications (user_id, notification_type, related_id)
    WHERE related_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'parking_sessions_coordinates_check'
          AND conrelid = 'public.parking_sessions'::regclass
    ) THEN
        ALTER TABLE parking_sessions
            ADD CONSTRAINT parking_sessions_coordinates_check
            CHECK (
                latitude >= -90 AND latitude <= 90 AND
                longitude >= -180 AND longitude <= 180
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'parking_sessions_duration_check'
          AND conrelid = 'public.parking_sessions'::regclass
    ) THEN
        ALTER TABLE parking_sessions
            ADD CONSTRAINT parking_sessions_duration_check
            CHECK (duration_minutes IS NULL OR duration_minutes >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'parking_sessions_alert_count_check'
          AND conrelid = 'public.parking_sessions'::regclass
    ) THEN
        ALTER TABLE parking_sessions
            ADD CONSTRAINT parking_sessions_alert_count_check
            CHECK (alerts_received_count >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'parking_sessions_state_check'
          AND conrelid = 'public.parking_sessions'::regclass
    ) THEN
        ALTER TABLE parking_sessions
            ADD CONSTRAINT parking_sessions_state_check
            CHECK (
                (is_active = true AND ended_at IS NULL) OR
                (is_active = false AND ended_at IS NOT NULL)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'enforcement_alerts_coordinates_check'
          AND conrelid = 'public.enforcement_alerts'::regclass
    ) THEN
        ALTER TABLE enforcement_alerts
            ADD CONSTRAINT enforcement_alerts_coordinates_check
            CHECK (
                latitude >= -90 AND latitude <= 90 AND
                longitude >= -180 AND longitude <= 180
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'enforcement_alerts_type_check'
          AND conrelid = 'public.enforcement_alerts'::regclass
    ) THEN
        ALTER TABLE enforcement_alerts
            ADD CONSTRAINT enforcement_alerts_type_check
            CHECK (enforcement_type IN ('chalking', 'ticketing'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'enforcement_alerts_severity_check'
          AND conrelid = 'public.enforcement_alerts'::regclass
    ) THEN
        ALTER TABLE enforcement_alerts
            ADD CONSTRAINT enforcement_alerts_severity_check
            CHECK (severity IN ('low', 'medium', 'high'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'enforcement_alerts_status_check'
          AND conrelid = 'public.enforcement_alerts'::regclass
    ) THEN
        ALTER TABLE enforcement_alerts
            ADD CONSTRAINT enforcement_alerts_status_check
            CHECK (status IN ('active', 'resolved', 'expired'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_type_check'
          AND conrelid = 'public.notifications'::regclass
    ) THEN
        ALTER TABLE notifications
            ADD CONSTRAINT notifications_type_check
            CHECK (
                notification_type IN (
                    'enforcement_alert', 'parking_expiring', 'ticket_added',
                    'verification_received', 'karma_milestone', 'system'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_status_check'
          AND conrelid = 'public.notifications'::regclass
    ) THEN
        ALTER TABLE notifications
            ADD CONSTRAINT notifications_status_check
            CHECK (status IN ('pending', 'sent', 'failed', 'read'));
    END IF;
END $$;
