package database

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
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
  
  enforcement_type VARCHAR(20) NOT NULL,
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
