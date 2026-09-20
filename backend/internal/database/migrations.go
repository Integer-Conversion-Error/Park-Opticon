package database

const enableRequiredExtensions = `
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
`

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  phone_number VARCHAR(20),
  
  avatar_url TEXT,
  bio TEXT,
  karma_points INTEGER DEFAULT 0,
  
  push_notification_token TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  enforcement_alerts_enabled BOOLEAN DEFAULT true,
  parking_radius_miles DECIMAL(4,2) DEFAULT 0.5,
  
  email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_karma ON users(karma_points DESC);
`

const createVehiclesTable = `
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  nickname VARCHAR(100),
  make VARCHAR(50),
  model VARCHAR(50),
  year INTEGER,
  color VARCHAR(30),
  license_plate VARCHAR(20) NOT NULL,
  state_province VARCHAR(30),
  
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(license_plate);
`

const createParkingSpotsTable = `
CREATE TABLE IF NOT EXISTS parking_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  street_name VARCHAR(200),
  
  spot_type VARCHAR(50),
  duration_estimate INTEGER,
  notes TEXT,
  
  status VARCHAR(20) DEFAULT 'available',
  verified_by_count INTEGER DEFAULT 0,
  flagged_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  taken_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_parking_spots_status ON parking_spots(status);
CREATE INDEX IF NOT EXISTS idx_parking_spots_created ON parking_spots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parking_spots_location ON parking_spots USING GIST(location);
`

const createParkingSpotPhotosTable = `
CREATE TABLE IF NOT EXISTS parking_spot_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes INTEGER,
  mime_type VARCHAR(50),
  
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spot_photos_spot ON parking_spot_photos(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_photos_uploader ON parking_spot_photos(uploader_id);
`

const createEnforcementAlertsTable = `
CREATE TABLE IF NOT EXISTS enforcement_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  street_name VARCHAR(200),
  
  enforcement_type VARCHAR(20) NOT NULL CHECK (enforcement_type IN ('chalking', 'ticketing')),
  description TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  
  status VARCHAR(20) DEFAULT 'active',
  verified_by_count INTEGER DEFAULT 0,
  flagged_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 hours'),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_enforcement_type ON enforcement_alerts(enforcement_type);
CREATE INDEX IF NOT EXISTS idx_enforcement_status ON enforcement_alerts(status);
CREATE INDEX IF NOT EXISTS idx_enforcement_created ON enforcement_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enforcement_location ON enforcement_alerts USING GIST(location);
`

const createEnforcementAlertPhotosTable = `
CREATE TABLE IF NOT EXISTS enforcement_alert_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES enforcement_alerts(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes INTEGER,
  mime_type VARCHAR(50),
  
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_photos_alert ON enforcement_alert_photos(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_photos_uploader ON enforcement_alert_photos(uploader_id);
`

const createParkingSessionsTable = `
CREATE TABLE IF NOT EXISTS parking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  
  is_active BOOLEAN DEFAULT true,
  alerts_received_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON parking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON parking_sessions(is_active, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_location ON parking_sessions USING GIST(location);
`

const createTicketsTable = `
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  ticket_number VARCHAR(100) UNIQUE,
  citation_number VARCHAR(100),
  violation_type VARCHAR(200) NOT NULL,
  violation_description TEXT,
  
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  
  location GEOGRAPHY(POINT, 4326),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  issued_date DATE NOT NULL,
  issued_time TIME,
  
  status VARCHAR(20) DEFAULT 'unpaid',
  due_date DATE,
  paid_date DATE,
  paid_amount_cents INTEGER,
  
  appealed_at TIMESTAMP WITH TIME ZONE,
  appeal_status VARCHAR(20),
  appeal_notes TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_vehicle ON tickets(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_issued ON tickets(issued_date DESC);
`

const createTicketPhotosTable = `
CREATE TABLE IF NOT EXISTS ticket_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes INTEGER,
  mime_type VARCHAR(50),
  
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_photos_ticket ON ticket_photos(ticket_id);
`

const createVerificationsTable = `
CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  verifiable_type VARCHAR(50) NOT NULL,
  verifiable_id UUID NOT NULL,
  
  verification_type VARCHAR(20) NOT NULL,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, verifiable_type, verifiable_id)
);

CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_target ON verifications(verifiable_type, verifiable_id);
`

const createNotificationsTable = `
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  
  related_type VARCHAR(50),
  related_id UUID,
  
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
`

const createUserSessionsTable = `
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  refresh_token VARCHAR(500) NOT NULL,
  device_info TEXT,
  ip_address VARCHAR(45),
  
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(refresh_token);
`

const createAuditLogsTable = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);
`

const addParkingSpotPolygonColumns = `
-- Add polygon corner columns for defining parking spot boundaries
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS corner1_lat DECIMAL(10, 8);
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS corner1_lon DECIMAL(11, 8);
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS corner2_lat DECIMAL(10, 8);
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS corner2_lon DECIMAL(11, 8);
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS corner3_lat DECIMAL(10, 8);
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS corner3_lon DECIMAL(11, 8);
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS corner4_lat DECIMAL(10, 8);
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS corner4_lon DECIMAL(11, 8);

-- Add geofence column as geometry type  
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS geofence GEOMETRY(POLYGON, 4326);
CREATE INDEX IF NOT EXISTS idx_parking_spots_geofence ON parking_spots USING GIST(geofence);
`

const addGeofenceTable = `
-- Geofence zones for parking enforcement
CREATE TABLE IF NOT EXISTS geofence_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  zone_type VARCHAR(50) NOT NULL,
  
  geofence GEOMETRY(POLYGON, 4326) NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_geofence ON geofence_zones USING GIST(geofence);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_type ON geofence_zones(zone_type);
`

const createParkingSpotTemplatesAndSchedules = `
-- Parking spot templates for reusable spot configurations
CREATE TABLE IF NOT EXISTS parking_spot_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    spot_type VARCHAR(50),
    duration_estimate INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enforcement schedules for parking spots (can be associated with spots or templates)
CREATE TABLE IF NOT EXISTS enforcement_schedules (
    id SERIAL PRIMARY KEY,
    parking_spot_id UUID REFERENCES parking_spots(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES parking_spot_templates(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    schedule_type VARCHAR(50) NOT NULL, -- 'enforced', 'enforced_unpaid', 'no_parking', 'no_stopping', 'free', 'unenforced'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6),
    CONSTRAINT check_schedule_type CHECK (schedule_type IN ('enforced', 'enforced_unpaid', 'no_parking', 'no_stopping', 'free', 'unenforced')),
    CONSTRAINT check_has_spot_or_template CHECK (
        (parking_spot_id IS NOT NULL AND template_id IS NULL) OR
        (parking_spot_id IS NULL AND template_id IS NOT NULL)
    )
);

-- Add template reference to parking_spots
ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES parking_spot_templates(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_enforcement_schedules_spot ON enforcement_schedules(parking_spot_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_schedules_template ON enforcement_schedules(template_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_schedules_day ON enforcement_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_parking_spots_template ON parking_spots(template_id);

-- Insert some sample templates
INSERT INTO parking_spot_templates (name, description, spot_type, duration_estimate, notes)
VALUES 
    ('Standard Street Parking', 'Regular metered street parking with 2-hour limit', 'street', 120, 'Enforced Mon-Fri 8am-6pm'),
    ('Residential Permit Zone', 'Permit-only parking for residents', 'street', NULL, 'No parking without permit'),
    ('Loading Zone', '15-minute loading zone for deliveries', 'street', 15, 'No parking, loading only'),
    ('Free Weekend Parking', 'Free parking on weekends', 'street', NULL, 'Free Sat-Sun, enforced weekdays')
ON CONFLICT (name) DO NOTHING;

-- Insert sample enforcement schedules for templates
-- Standard Street Parking: Enforced Mon-Fri 8am-6pm, Free weekends
INSERT INTO enforcement_schedules (template_id, day_of_week, start_time, end_time, schedule_type, description)
SELECT id, 1, '08:00:00'::TIME, '18:00:00'::TIME, 'enforced', 'Monday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 2, '08:00:00'::TIME, '18:00:00'::TIME, 'enforced', 'Tuesday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 3, '08:00:00'::TIME, '18:00:00'::TIME, 'enforced', 'Wednesday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 4, '08:00:00'::TIME, '18:00:00'::TIME, 'enforced', 'Thursday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 5, '08:00:00'::TIME, '18:00:00'::TIME, 'enforced', 'Friday enforcement'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 0, '00:00:00'::TIME, '23:59:59'::TIME, 'free', 'Sunday free parking'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
UNION ALL
SELECT id, 6, '00:00:00'::TIME, '23:59:59'::TIME, 'free', 'Saturday free parking'
FROM parking_spot_templates WHERE name = 'Standard Street Parking'
ON CONFLICT DO NOTHING;

-- Loading Zone: No parking all week 7am-7pm, loading only
INSERT INTO enforcement_schedules (template_id, day_of_week, start_time, end_time, schedule_type, description)
SELECT id, gs.day, '07:00:00'::TIME, '19:00:00'::TIME, 'no_parking', 'Loading only'
FROM parking_spot_templates, generate_series(0, 6) gs(day)
WHERE name = 'Loading Zone'
ON CONFLICT DO NOTHING;
`

const fixScheduleTypeConstraint = `
-- Fix the check_schedule_type constraint to include all schedule types
ALTER TABLE enforcement_schedules DROP CONSTRAINT IF EXISTS check_schedule_type;

ALTER TABLE enforcement_schedules ADD CONSTRAINT check_schedule_type 
CHECK (schedule_type IN ('enforced', 'enforced_unpaid', 'no_parking', 'no_stopping', 'free', 'unenforced'));
`

const hardenCoreIntegrity = `
-- One active parking session per user. This closes the check-then-insert race
-- in the API handler and matches the product rule that a user parks one car
-- at a time in this first version.
CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_sessions_one_active_user
  ON parking_sessions (user_id)
  WHERE is_active = true;

-- Foreign-key indexes used by the session and report paths.
CREATE INDEX IF NOT EXISTS idx_parking_sessions_vehicle
  ON parking_sessions (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_alerts_reporter
  ON enforcement_alerts (reporter_id);

-- The alert worker de-duplicates in application code; this constraint makes
-- that guarantee hold across restarts or multiple worker instances too.
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
`

const addMobileReportLifecycle = `
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
`

const securityHardening = `
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
`

const purgeLegacyRefreshTokens = `
UPDATE user_sessions
SET refresh_token = NULL
WHERE refresh_token IS NOT NULL AND refresh_token_hash IS NOT NULL;

DROP INDEX IF EXISTS idx_sessions_token;
`

const normalizeGeofenceType = `
-- Normalize legacy geofence columns to the runtime API's GeoJSON Polygon type.
-- Older bootstrap installs used geography(MULTIPOLYGON), while the runtime API
-- accepts and returns a single geometry(POLYGON).
ALTER TABLE parking_spots
    ALTER COLUMN geofence TYPE GEOMETRY(POLYGON, 4326)
    USING CASE
        WHEN geofence IS NULL THEN NULL
        WHEN GeometryType(geofence::geometry) = 'MULTIPOLYGON'
            THEN ST_GeometryN(geofence::geometry, 1)
        ELSE geofence::geometry
    END;
`

const addAlertDeliveryPipeline = `
-- Alert processing is an event pipeline: an alert/session write creates a
-- durable job, a worker claims it, then device deliveries are retried
-- independently. The legacy users.push_notification_token is retained for
-- API compatibility while user_devices supports multiple devices per account.
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

-- The queue looks up only current spatial state. These partial GiST indexes
-- prevent expired alert/session history from inflating the hot path.
CREATE INDEX IF NOT EXISTS idx_enforcement_alerts_active_location
    ON enforcement_alerts USING GIST (location)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_parking_sessions_active_location
    ON parking_sessions USING GIST (location)
    WHERE is_active = true;
`

const expandNotificationRadius = `
-- Preserve existing explicit preferences while making 1 km the default for
-- new accounts and allowing the expanded 2.5 km alert radius.
ALTER TABLE users
    ALTER COLUMN notification_radius_meters SET DEFAULT 1000;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_notification_radius_check;
ALTER TABLE users
    ADD CONSTRAINT users_notification_radius_check
    CHECK (notification_radius_meters BETWEEN 100 AND 2500);
`

const addCommunityImpactIndexes = `
-- The profile aggregate filters authored parking reports by reporter_id and
-- joins alert notifications by related_id. These narrow indexes keep the
-- read bounded as historical report and notification volume grows.
CREATE INDEX IF NOT EXISTS idx_parking_spots_reporter_id
    ON parking_spots (reporter_id);

CREATE INDEX IF NOT EXISTS idx_notifications_enforcement_related_recipient
    ON notifications (related_id, user_id)
    WHERE notification_type = 'enforcement_alert'
      AND related_type = 'enforcement_alert';
`

const addOAuthIdentities = `
-- Passwordless accounts have no locally usable password. A NULL hash is
-- deliberately distinct from a generated placeholder so it cannot become a
-- surprise sign-in or recovery credential.
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

-- Challenges bind a provider-issued ID token to one brief, server-created
-- request. Only a SHA-256 digest is stored; the raw nonce is never persisted.
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
`

const addOAuthLinkReauthentication = `
-- Linking a new external identity changes the account's durable recovery and
-- login surface, so it requires a fresh proof of control over the current
-- Park Opticon account. The raw proof is returned once to the app; only its
-- hash is stored and it is consumed by the link transaction.
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
`

const limitNotificationRadius = `
-- Cap existing preferences before enforcing the reduced 1.5 km maximum.
-- The default stays at 1 km. Run atomically so concurrent writes cannot keep
-- an out-of-range preference between the update and the constraint change.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_notification_radius_check;

UPDATE users
SET notification_radius_meters = 1500, updated_at = CURRENT_TIMESTAMP
WHERE notification_radius_meters > 1500;

ALTER TABLE users
    ADD CONSTRAINT users_notification_radius_check
    CHECK (notification_radius_meters BETWEEN 100 AND 1500);
`
