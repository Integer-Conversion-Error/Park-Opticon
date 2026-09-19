-- Durable, event-driven enforcement alert processing.
-- This is the fresh-bootstrap equivalent of runtime migration 23.

CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    platform VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_devices_push_token_not_blank CHECK (length(btrim(push_token)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_push_token
    ON user_devices (push_token);
CREATE INDEX IF NOT EXISTS idx_user_devices_active_user
    ON user_devices (user_id)
    WHERE is_active = true;

INSERT INTO user_devices (user_id, push_token, is_active, last_seen_at)
SELECT id, btrim(push_notification_token), true, CURRENT_TIMESTAMP
FROM users
WHERE NULLIF(btrim(push_notification_token), '') IS NOT NULL
ON CONFLICT (push_token) DO NOTHING;

CREATE TABLE IF NOT EXISTS alert_dispatch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(40) NOT NULL,
    alert_id UUID REFERENCES enforcement_alerts(id) ON DELETE CASCADE,
    parking_session_id UUID REFERENCES parking_sessions(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts SMALLINT NOT NULL DEFAULT 8,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT alert_dispatch_jobs_event_type_check CHECK (
        event_type IN ('enforcement_alert_created', 'parking_session_started')
    ),
    CONSTRAINT alert_dispatch_jobs_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'failed')
    ),
    CONSTRAINT alert_dispatch_jobs_attempts_check CHECK (
        attempts >= 0 AND max_attempts > 0
    ),
    CONSTRAINT alert_dispatch_jobs_target_check CHECK (
        (event_type = 'enforcement_alert_created' AND alert_id IS NOT NULL AND parking_session_id IS NULL)
        OR
        (event_type = 'parking_session_started' AND parking_session_id IS NOT NULL AND alert_id IS NULL)
    ),
    CONSTRAINT alert_dispatch_jobs_unique_alert_event UNIQUE (event_type, alert_id),
    CONSTRAINT alert_dispatch_jobs_unique_session_event UNIQUE (event_type, parking_session_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_dispatch_jobs_ready
    ON alert_dispatch_jobs (available_at, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_alert_dispatch_jobs_processing_lease
    ON alert_dispatch_jobs (locked_at)
    WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_alert_dispatch_jobs_alert
    ON alert_dispatch_jobs (alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_dispatch_jobs_session
    ON alert_dispatch_jobs (parking_session_id);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts SMALLINT NOT NULL DEFAULT 8,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by TEXT,
    provider_ticket_id TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notification_deliveries_status_check CHECK (
        status IN ('pending', 'processing', 'sent', 'failed')
    ),
    CONSTRAINT notification_deliveries_attempts_check CHECK (
        attempts >= 0 AND max_attempts > 0
    ),
    CONSTRAINT notification_deliveries_one_per_device UNIQUE (notification_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_ready
    ON notification_deliveries (available_at, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_processing_lease
    ON notification_deliveries (locked_at)
    WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_device
    ON notification_deliveries (device_id);

CREATE INDEX IF NOT EXISTS idx_enforcement_alerts_active_location
    ON enforcement_alerts USING GIST (location)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_parking_sessions_active_location
    ON parking_sessions USING GIST (location)
    WHERE is_active = true;
