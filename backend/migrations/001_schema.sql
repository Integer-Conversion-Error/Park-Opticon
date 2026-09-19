-- Park Opticon Database Schema
-- Complete normalized schema with PostGIS support for geospatial data

-- Enable PostGIS extension for geospatial support
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE USER MANAGEMENT
-- ============================================================================

-- Users table - Core user accounts
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    
    -- Profile information
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    avatar_url TEXT,
    bio TEXT,
    
    -- Gamification
    karma_points INTEGER DEFAULT 0 NOT NULL,
    
    -- Preferences
    push_notification_token TEXT,
    notifications_enabled BOOLEAN DEFAULT true NOT NULL,
    enforcement_alerts_enabled BOOLEAN DEFAULT true NOT NULL,
    parking_radius_miles DECIMAL(5,2) DEFAULT 0.5 NOT NULL,
    
    -- Account status
    email_verified BOOLEAN DEFAULT false NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    is_admin BOOLEAN DEFAULT false NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_admin ON users(is_admin);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- VEHICLE MANAGEMENT
-- ============================================================================

-- Vehicles table - User's registered vehicles
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Vehicle details
    nickname VARCHAR(100),
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    color VARCHAR(50),
    license_plate VARCHAR(20) NOT NULL,
    state_province VARCHAR(50),
    
    -- Status
    is_default BOOLEAN DEFAULT false NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT vehicles_year_check CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 2)
);

CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_is_default ON vehicles(is_default);

-- ============================================================================
-- PARKING MANAGEMENT
-- ============================================================================

-- Parking spots table - User-reported available parking spots
CREATE TABLE parking_spots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Location (Point geometry for precise location)
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Geofence for individual parking spaces (MultiPolygon to support multiple spaces)
    geofence GEOMETRY(POLYGON, 4326),
    
    -- Address information
    address TEXT,
    street_name VARCHAR(255),
    
    -- Spot details
    spot_type VARCHAR(50) CHECK (spot_type IN ('street', 'garage', 'lot', 'private')),
    duration_estimate INTEGER, -- in minutes
    notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'unknown')) NOT NULL,
    
    -- Validation tracking
    verified_by_count INTEGER DEFAULT 0 NOT NULL,
    flagged_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    taken_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT parking_spots_coordinates_check CHECK (
        latitude >= -90 AND latitude <= 90 AND
        longitude >= -180 AND longitude <= 180
    )
);

CREATE INDEX idx_parking_spots_location ON parking_spots USING GIST(location);
CREATE INDEX idx_parking_spots_geofence ON parking_spots USING GIST(geofence);
CREATE INDEX idx_parking_spots_reporter_id ON parking_spots(reporter_id);
CREATE INDEX idx_parking_spots_status ON parking_spots(status);
CREATE INDEX idx_parking_spots_created_at ON parking_spots(created_at);
CREATE INDEX idx_parking_spots_expires_at ON parking_spots(expires_at);

-- Individual parking spaces (normalized from geofence for easier management)
CREATE TABLE parking_spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parking_spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
    
    -- Space boundary (Polygon for individual space)
    boundary GEOGRAPHY(POLYGON, 4326) NOT NULL,
    
    -- Space details
    space_number INTEGER,
    is_accessible BOOLEAN DEFAULT false,
    is_ev_charging BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'disabled')) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_parking_spaces_spot_id ON parking_spaces(parking_spot_id);
CREATE INDEX idx_parking_spaces_boundary ON parking_spaces USING GIST(boundary);
CREATE INDEX idx_parking_spaces_status ON parking_spaces(status);

-- ============================================================================
-- ENFORCEMENT ALERTS
-- ============================================================================

-- Enforcement alerts table - User-reported enforcement activity
CREATE TABLE enforcement_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Location
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Address information
    address TEXT,
    street_name VARCHAR(255),
    
    -- Alert details
    enforcement_type VARCHAR(50) CHECK (enforcement_type IN ('chalking', 'ticketing')) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')) NOT NULL,
    
    -- Validation tracking
    verified_by_count INTEGER DEFAULT 0 NOT NULL,
    flagged_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT enforcement_alerts_coordinates_check CHECK (
        latitude >= -90 AND latitude <= 90 AND
        longitude >= -180 AND longitude <= 180
    )
);

CREATE INDEX idx_enforcement_alerts_location ON enforcement_alerts USING GIST(location);
CREATE INDEX idx_enforcement_alerts_reporter_id ON enforcement_alerts(reporter_id);
CREATE INDEX idx_enforcement_alerts_status ON enforcement_alerts(status);
CREATE INDEX idx_enforcement_alerts_created_at ON enforcement_alerts(created_at);
CREATE INDEX idx_enforcement_alerts_expires_at ON enforcement_alerts(expires_at);

-- ============================================================================
-- PARKING SESSIONS
-- ============================================================================

-- Parking sessions table - Track user's active parking sessions
CREATE TABLE parking_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    
    -- Location
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    
    -- Session details
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true NOT NULL,
    alerts_received_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_parking_sessions_user_id ON parking_sessions(user_id);
CREATE INDEX idx_parking_sessions_vehicle_id ON parking_sessions(vehicle_id);
CREATE INDEX idx_parking_sessions_location ON parking_sessions USING GIST(location);
CREATE INDEX idx_parking_sessions_is_active ON parking_sessions(is_active);
CREATE INDEX idx_parking_sessions_started_at ON parking_sessions(started_at);

-- ============================================================================
-- TICKETS & CITATIONS
-- ============================================================================

-- Tickets table - User's parking tickets/citations
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    
    -- Ticket identification
    ticket_number VARCHAR(100),
    citation_number VARCHAR(100),
    
    -- Violation details
    violation_type VARCHAR(100) NOT NULL,
    violation_description TEXT,
    
    -- Financial
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    
    -- Location
    location GEOGRAPHY(POINT, 4326),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    
    -- Dates
    issued_date DATE NOT NULL,
    issued_time TIME,
    due_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'appealed', 'dismissed')) NOT NULL,
    
    -- Payment
    paid_date DATE,
    paid_amount_cents INTEGER,
    
    -- Appeal
    appealed_at TIMESTAMP WITH TIME ZONE,
    appeal_status VARCHAR(20) CHECK (appeal_status IN ('pending', 'approved', 'denied')),
    appeal_notes TEXT,
    
    -- Additional info
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_vehicle_id ON tickets(vehicle_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_issued_date ON tickets(issued_date);
CREATE INDEX idx_tickets_due_date ON tickets(due_date);

-- ============================================================================
-- MEDIA & ATTACHMENTS
-- ============================================================================

-- Photos table - Polymorphic photo attachments
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Polymorphic relationship
    photoable_type VARCHAR(50) NOT NULL CHECK (photoable_type IN (
        'parking_spot', 'enforcement_alert', 'ticket', 'vehicle'
    )),
    photoable_id UUID NOT NULL,
    
    -- Photo details
    photo_url TEXT NOT NULL,
    thumbnail_url TEXT,
    file_size_bytes INTEGER,
    mime_type VARCHAR(100),
    
    -- Metadata
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Status
    is_flagged BOOLEAN DEFAULT false NOT NULL,
    is_verified BOOLEAN DEFAULT false NOT NULL
);

CREATE INDEX idx_photos_photoable ON photos(photoable_type, photoable_id);
CREATE INDEX idx_photos_uploaded_by ON photos(uploaded_by);

-- ============================================================================
-- VERIFICATION & FLAGGING SYSTEM
-- ============================================================================

-- Verifications table - Track user verifications and flags
CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Polymorphic relationship
    verifiable_type VARCHAR(50) NOT NULL CHECK (verifiable_type IN (
        'parking_spot', 'enforcement_alert'
    )),
    verifiable_id UUID NOT NULL,
    
    -- Verification type
    verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN ('verify', 'flag')),
    
    -- Details
    notes TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Prevent duplicate verifications
    UNIQUE (user_id, verifiable_type, verifiable_id, verification_type)
);

CREATE INDEX idx_verifications_user_id ON verifications(user_id);
CREATE INDEX idx_verifications_verifiable ON verifications(verifiable_type, verifiable_id);
CREATE INDEX idx_verifications_type ON verifications(verification_type);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

-- Notifications table - Push notifications and in-app messages
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'enforcement_alert', 'parking_expiring', 'ticket_added', 
        'verification_received', 'karma_milestone', 'system'
    )),
    
    -- Related entity (optional)
    related_type VARCHAR(50),
    related_id UUID,
    
    -- Delivery status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================================================
-- ANALYTICS & ACTIVITY
-- ============================================================================

-- User activity log for analytics
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    
    -- Metadata (JSONB for flexible data)
    metadata JSONB,
    
    -- Location context
    location GEOGRAPHY(POINT, 4326),
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at);
CREATE INDEX idx_user_activity_metadata ON user_activity USING GIN(metadata);

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parking_spaces_updated_at BEFORE UPDATE ON parking_spaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parking_sessions_updated_at BEFORE UPDATE ON parking_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to sync lat/lng with geography point
CREATE OR REPLACE FUNCTION sync_location_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply location sync triggers
CREATE TRIGGER sync_parking_spots_location BEFORE INSERT OR UPDATE ON parking_spots
    FOR EACH ROW EXECUTE FUNCTION sync_location_fields();

CREATE TRIGGER sync_enforcement_alerts_location BEFORE INSERT OR UPDATE ON enforcement_alerts
    FOR EACH ROW EXECUTE FUNCTION sync_location_fields();

CREATE TRIGGER sync_parking_sessions_location BEFORE INSERT OR UPDATE ON parking_sessions
    FOR EACH ROW EXECUTE FUNCTION sync_location_fields();

CREATE TRIGGER sync_tickets_location BEFORE INSERT OR UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION sync_location_fields();

-- Function to auto-expire old parking spots
CREATE OR REPLACE FUNCTION expire_old_parking_spots()
RETURNS void AS $$
BEGIN
    UPDATE parking_spots
    SET status = 'unknown'
    WHERE status = 'available'
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-resolve expired enforcement alerts
CREATE OR REPLACE FUNCTION resolve_expired_alerts()
RETURNS void AS $$
BEGIN
    UPDATE enforcement_alerts
    SET status = 'expired', resolved_at = CURRENT_TIMESTAMP
    WHERE status = 'active'
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active parking spots with distance calculation capability
CREATE VIEW active_parking_spots AS
SELECT 
    ps.*,
    u.username as reporter_username,
    COUNT(DISTINCT psp.id) as space_count
FROM parking_spots ps
LEFT JOIN users u ON ps.reporter_id = u.id
LEFT JOIN parking_spaces psp ON psp.parking_spot_id = ps.id
WHERE ps.status = 'available'
    AND (ps.expires_at IS NULL OR ps.expires_at > CURRENT_TIMESTAMP)
GROUP BY ps.id, u.username;

-- Active enforcement alerts
CREATE VIEW active_enforcement_alerts AS
SELECT 
    ea.*,
    u.username as reporter_username
FROM enforcement_alerts ea
LEFT JOIN users u ON ea.reporter_id = u.id
WHERE ea.status = 'active'
    AND ea.expires_at > CURRENT_TIMESTAMP;

-- User statistics
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.username,
    u.karma_points,
    COUNT(DISTINCT ps.id) as spots_reported,
    COUNT(DISTINCT ea.id) as alerts_reported,
    COUNT(DISTINCT v.id) as verifications_made,
    COUNT(DISTINCT t.id) as tickets_count
FROM users u
LEFT JOIN parking_spots ps ON ps.reporter_id = u.id
LEFT JOIN enforcement_alerts ea ON ea.reporter_id = u.id
LEFT JOIN verifications v ON v.user_id = u.id
LEFT JOIN tickets t ON t.user_id = u.id
GROUP BY u.id;

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Core user accounts with authentication and profile data';
COMMENT ON TABLE vehicles IS 'User-registered vehicles for parking session tracking';
COMMENT ON TABLE parking_spots IS 'User-reported available parking locations';
COMMENT ON TABLE parking_spaces IS 'Individual parking spaces within a parking spot area';
COMMENT ON TABLE enforcement_alerts IS 'User-reported parking enforcement activity';
COMMENT ON TABLE parking_sessions IS 'Active and historical parking sessions';
COMMENT ON TABLE tickets IS 'User parking tickets and citations';
COMMENT ON TABLE photos IS 'Polymorphic photo attachments for various entities';
COMMENT ON TABLE verifications IS 'User verifications and flags for crowdsourced validation';
COMMENT ON TABLE notifications IS 'Push notifications and in-app messages';
COMMENT ON TABLE user_activity IS 'Activity log for analytics and user behavior tracking';

COMMENT ON COLUMN parking_spots.geofence IS 'MultiPolygon containing multiple individual parking space boundaries';
COMMENT ON COLUMN parking_spaces.boundary IS 'Polygon boundary for a single parking space';
COMMENT ON COLUMN photos.photoable_type IS 'Polymorphic relationship: parking_spot, enforcement_alert, ticket, vehicle';
COMMENT ON COLUMN verifications.verifiable_type IS 'Polymorphic relationship: parking_spot, enforcement_alert';
