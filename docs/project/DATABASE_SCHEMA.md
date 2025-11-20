# 🗄️ Park-Opticon Database Schema

**Comprehensive database design for the Park-Opticon backend**

---

## 📋 Overview

This schema supports all Park-Opticon features:
- User authentication and profiles
- Parking spot reports with photos
- Enforcement alerts (ticketing, chalking, towing)
- Parking sessions with location tracking
- Ticket management
- Push notifications
- Reputation/karma system

**Database: PostgreSQL with PostGIS for geospatial queries**

---

## 📊 Core Tables

### 1. Users

Stores user accounts and authentication data.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- bcrypt hashed
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  phone_number VARCHAR(20),
  
  -- Profile
  avatar_url TEXT,
  bio TEXT,
  karma_points INTEGER DEFAULT 0, -- Reputation score
  
  -- Settings
  push_notification_token TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  enforcement_alerts_enabled BOOLEAN DEFAULT true,
  parking_radius_miles DECIMAL(4,2) DEFAULT 0.5, -- Alert radius for parked car
  
  -- Metadata
  email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes
  INDEX idx_users_email (email),
  INDEX idx_users_username (username),
  INDEX idx_users_karma (karma_points DESC)
);
```

**Karma System Rules:**
- Report parking spot: +5 points
- Report enforcement: +10 points
- Photo included: +3 points
- Report verified by others: +5 points
- False report (flagged): -20 points

---

### 2. Vehicles

User vehicles for parking session tracking.

```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Vehicle Details
  nickname VARCHAR(100), -- "Blue Honda Civic"
  make VARCHAR(50),
  model VARCHAR(50),
  year INTEGER,
  color VARCHAR(30),
  license_plate VARCHAR(20) NOT NULL,
  state_province VARCHAR(30),
  
  -- Settings
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_vehicles_user (user_id),
  INDEX idx_vehicles_plate (license_plate)
);
```

---

### 3. Parking Spots

Crowdsourced available parking spot reports.

```sql
CREATE TABLE parking_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Location
  location GEOGRAPHY(POINT, 4326) NOT NULL, -- PostGIS geospatial
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  street_name VARCHAR(200),
  
  -- Spot Details
  spot_type VARCHAR(50), -- 'street', 'lot', 'garage', 'driveway'
  duration_estimate INTEGER, -- Expected available minutes
  notes TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'available', -- 'available', 'taken', 'expired'
  verified_by_count INTEGER DEFAULT 0, -- How many users verified it
  flagged_count INTEGER DEFAULT 0, -- How many users reported it as false
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE, -- Auto-calculated from duration
  taken_at TIMESTAMP WITH TIME ZONE, -- When marked as taken
  
  -- Indexes
  INDEX idx_parking_spots_status (status),
  INDEX idx_parking_spots_created (created_at DESC),
  INDEX idx_parking_spots_location USING GIST(location)
);
```

**Business Logic:**
- Spots auto-expire after `duration_estimate` or 2 hours (whichever is shorter)
- Spots within 50m are considered duplicates (merged or flagged)
- Users can mark spot as "taken" if they park there

---

### 4. Parking Spot Photos

Photos attached to parking spot reports.

```sql
CREATE TABLE parking_spot_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Image Storage
  photo_url TEXT NOT NULL, -- S3/Cloud storage URL
  thumbnail_url TEXT, -- Smaller version for list views
  file_size_bytes INTEGER,
  mime_type VARCHAR(50),
  
  -- Metadata
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_spot_photos_spot (spot_id),
  INDEX idx_spot_photos_uploader (uploader_id)
);
```

---

### 5. Enforcement Alerts

Reports of parking enforcement activity (officers, chalking, towing).

```sql
CREATE TABLE enforcement_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Location
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  street_name VARCHAR(200),
  
  -- Alert Details
  enforcement_type VARCHAR(20) NOT NULL, -- 'ticketing', 'chalking', 'towing'
  description TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'resolved', 'expired'
  verified_by_count INTEGER DEFAULT 0,
  flagged_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 hours'),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes
  INDEX idx_enforcement_type (enforcement_type),
  INDEX idx_enforcement_status (status),
  INDEX idx_enforcement_created (created_at DESC),
  INDEX idx_enforcement_location USING GIST(location)
);
```

**Auto-Expiry:**
- Alerts expire after 2 hours by default
- Can be manually marked as resolved
- High severity alerts trigger push notifications

---

### 6. Enforcement Alert Photos

Photos attached to enforcement alerts.

```sql
CREATE TABLE enforcement_alert_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES enforcement_alerts(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Image Storage
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes INTEGER,
  mime_type VARCHAR(50),
  
  -- Metadata
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_alert_photos_alert (alert_id),
  INDEX idx_alert_photos_uploader (uploader_id)
);
```

---

### 7. Parking Sessions

Active parking sessions for tracking user's parked vehicle.

```sql
CREATE TABLE parking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- Location
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  
  -- Session Details
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER, -- Calculated on session end
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  alerts_received_count INTEGER DEFAULT 0, -- Enforcement alerts nearby
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_active (is_active, started_at DESC),
  INDEX idx_sessions_location USING GIST(location)
);
```

**Business Logic:**
- Only one active session per user at a time
- Background service checks for enforcement alerts within `parking_radius_miles`
- Sends push notification if enforcement detected nearby

---

### 8. Tickets

User-logged parking tickets.

```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- Ticket Details
  ticket_number VARCHAR(100) UNIQUE,
  citation_number VARCHAR(100),
  violation_type VARCHAR(200) NOT NULL,
  violation_description TEXT,
  
  -- Financial
  amount_cents INTEGER NOT NULL, -- Store as cents to avoid float issues
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Location & Time
  location GEOGRAPHY(POINT, 4326),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  issued_date DATE NOT NULL,
  issued_time TIME,
  
  -- Status
  status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'paid', 'appealed', 'dismissed', 'collections'
  due_date DATE,
  paid_date DATE,
  paid_amount_cents INTEGER,
  
  -- Appeal
  appealed_at TIMESTAMP WITH TIME ZONE,
  appeal_status VARCHAR(20), -- 'pending', 'approved', 'denied'
  appeal_notes TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_tickets_user (user_id),
  INDEX idx_tickets_vehicle (vehicle_id),
  INDEX idx_tickets_status (status),
  INDEX idx_tickets_issued (issued_date DESC)
);
```

---

### 9. Ticket Photos

Photos of tickets (for record keeping).

```sql
CREATE TABLE ticket_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  
  -- Image Storage
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes INTEGER,
  mime_type VARCHAR(50),
  
  -- Metadata
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_ticket_photos_ticket (ticket_id)
);
```

---

## 🔗 Supporting Tables

### 10. Verifications

Track which users verified a parking spot or enforcement alert.

```sql
CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Polymorphic relationship
  verifiable_type VARCHAR(50) NOT NULL, -- 'parking_spot', 'enforcement_alert'
  verifiable_id UUID NOT NULL,
  
  verification_type VARCHAR(20) NOT NULL, -- 'verified', 'taken', 'false_report'
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_verifications_user (user_id),
  INDEX idx_verifications_target (verifiable_type, verifiable_id),
  UNIQUE INDEX idx_verifications_unique (user_id, verifiable_type, verifiable_id)
);
```

---

### 11. Notifications

Push notification history for auditing and debugging.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification Content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL, -- 'enforcement_alert', 'spot_taken', 'ticket_reminder'
  
  -- Related Entity (polymorphic)
  related_type VARCHAR(50), -- 'enforcement_alert', 'parking_spot', 'ticket'
  related_id UUID,
  
  -- Delivery Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'read'
  sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_notifications_user (user_id, created_at DESC),
  INDEX idx_notifications_status (status)
);
```

---

### 12. User Sessions

JWT refresh tokens for authentication.

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Token
  refresh_token VARCHAR(500) NOT NULL,
  device_info TEXT, -- User agent, device type
  ip_address VARCHAR(45),
  
  -- Expiry
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_token (refresh_token)
);
```

---

### 13. Audit Log

Track important actions for security and debugging.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Action Details
  action VARCHAR(100) NOT NULL, -- 'user.login', 'spot.create', 'alert.report'
  entity_type VARCHAR(50), -- 'user', 'parking_spot', 'enforcement_alert'
  entity_id UUID,
  
  -- Context
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_data JSONB, -- Store additional context
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_audit_user (user_id, created_at DESC),
  INDEX idx_audit_action (action, created_at DESC)
);
```

---

## 🔍 Geospatial Queries

### Find Nearby Parking Spots

```sql
-- Find available parking spots within 1 mile of a location
SELECT 
  id,
  latitude,
  longitude,
  address,
  duration_estimate,
  ST_Distance(location, ST_MakePoint($longitude, $latitude)::geography) / 1609.34 AS distance_miles,
  created_at
FROM parking_spots
WHERE 
  status = 'available'
  AND ST_DWithin(
    location, 
    ST_MakePoint($longitude, $latitude)::geography, 
    1609.34  -- 1 mile in meters
  )
ORDER BY distance_miles ASC
LIMIT 50;
```

### Find Enforcement Alerts Near Parked Car

```sql
-- Check for enforcement within user's alert radius
SELECT 
  ea.id,
  ea.enforcement_type,
  ea.description,
  ea.severity,
  ST_Distance(ea.location, ps.location) / 1609.34 AS distance_miles
FROM enforcement_alerts ea
CROSS JOIN parking_sessions ps
WHERE 
  ps.user_id = $user_id
  AND ps.is_active = true
  AND ea.status = 'active'
  AND ea.created_at > ps.started_at
  AND ST_DWithin(
    ea.location,
    ps.location,
    (SELECT parking_radius_miles FROM users WHERE id = $user_id) * 1609.34
  )
ORDER BY ea.created_at DESC;
```

---

## 🔐 Security & Privacy

### Data Protection
- **Passwords**: bcrypt with salt rounds = 12
- **API Authentication**: JWT (access token: 15 min, refresh token: 7 days)
- **Location Privacy**: Only show approximate locations (round to 4 decimals = ~11m precision)
- **User Data**: GDPR compliant with user data export/deletion endpoints

### Rate Limiting
- Report parking spot: 10 per hour
- Report enforcement: 20 per hour
- API requests: 100 per minute per user

---

## 📈 Indexes & Performance

### Essential Indexes (already included above)
- Geospatial indexes on all location columns (GIST)
- Foreign key indexes for joins
- Timestamp indexes for recent queries
- Status/type indexes for filtering

### Materialized Views for Analytics

```sql
-- Daily statistics
CREATE MATERIALIZED VIEW daily_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE type = 'parking_spot') as spots_reported,
  COUNT(*) FILTER (WHERE type = 'enforcement') as alerts_reported,
  COUNT(DISTINCT user_id) as active_users
FROM (
  SELECT created_at, 'parking_spot' as type, reporter_id as user_id FROM parking_spots
  UNION ALL
  SELECT created_at, 'enforcement' as type, reporter_id as user_id FROM enforcement_alerts
) combined
GROUP BY DATE(created_at);

-- Refresh daily
CREATE INDEX ON daily_stats (date DESC);
```

---

## 🚀 Migration Strategy

### Phase 1: Core Features
1. Users & Authentication
2. Vehicles
3. Parking Spots & Photos
4. Enforcement Alerts & Photos

### Phase 2: Advanced Features
5. Parking Sessions
6. Notifications
7. Verifications

### Phase 3: Supporting Features
8. Tickets & Photos
9. Audit Logs
10. Analytics Views

---

## 📊 Sample Relationships

```
users (1) ─────→ (many) vehicles
users (1) ─────→ (many) parking_spots
users (1) ─────→ (many) enforcement_alerts
users (1) ─────→ (many) parking_sessions
users (1) ─────→ (many) tickets
users (1) ─────→ (many) verifications
users (1) ─────→ (many) notifications

parking_spots (1) ─────→ (many) parking_spot_photos
enforcement_alerts (1) ─────→ (many) enforcement_alert_photos
tickets (1) ─────→ (many) ticket_photos

vehicles (1) ─────→ (many) parking_sessions
vehicles (1) ─────→ (many) tickets
```

---

## 🎯 Next Steps

1. **Set up PostgreSQL with PostGIS extension**
2. **Create migration files** (using a migration tool like node-pg-migrate or Knex)
3. **Build API layer** (Node.js + Express + Prisma/TypeORM)
4. **Implement authentication** (JWT + bcrypt)
5. **Add geospatial queries** (PostGIS functions)
6. **Set up cloud storage** (S3 for photos)
7. **Implement push notifications** (Firebase Cloud Messaging)
8. **Add background jobs** (for alert checking and expiration)

---

**Ready to build the backend? Let me know which stack you prefer!**
- Option A: Node.js + Express + Prisma + PostgreSQL
- Option B: Node.js + Express + TypeORM + PostgreSQL
- Option C: Node.js + Fastify + Drizzle + PostgreSQL
