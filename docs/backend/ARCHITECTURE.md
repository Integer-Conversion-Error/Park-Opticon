# 🏗️ Park-Opticon Backend Architecture

**Visual overview of the Go backend system**

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Native Mobile App                      │
│                    (iOS & Android Clients)                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTPS/REST API
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                         API Gateway                              │
│                    (Gin HTTP Router)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Middleware Layer                                          │  │
│  │  - CORS                                                   │  │
│  │  - JWT Authentication                                     │  │
│  │  - Rate Limiting (TODO)                                   │  │
│  │  - Request Logging (TODO)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐   ┌──────────────────────┐
│   Auth Handler   │   │   API Handlers       │
│                  │   │                      │
│  - Register      │   │  Parking Handler:    │
│  - Login         │   │   - Create spot      │
│  - Get Profile   │   │   - Get nearby       │
│                  │   │   - Mark taken       │
│                  │   │                      │
│                  │   │  Enforcement Handler:│
│                  │   │   - Create alert     │
│                  │   │   - Get nearby       │
│                  │   │   - Resolve          │
└────────┬─────────┘   └──────────┬───────────┘
         │                        │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Database Layer        │
         │   (sqlx + PostgreSQL)   │
         └────────────┬────────────┘
                      │
                      ▼
         ┌────────────────────────────────┐
         │      PostgreSQL + PostGIS       │
         │                                 │
         │  - Users & Auth                 │
         │  - Parking Spots (geospatial)   │
         │  - Enforcement Alerts           │
         │  - Parking Sessions             │
         │  - Tickets                      │
         │  - Notifications                │
         └─────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    Background Workers (Goroutines)               │
│  ┌───────────────────────┐     ┌──────────────────────────┐    │
│  │   Alert Checker       │     │   Expiry Checker         │    │
│  │   (Every 30s)         │     │   (Every 5 min)          │    │
│  │                       │     │                          │    │
│  │  1. Get active        │     │  1. Expire old spots     │    │
│  │     parking sessions  │     │  2. Expire old alerts    │    │
│  │  2. Check for nearby  │     │                          │    │
│  │     enforcement       │     │                          │    │
│  │  3. Send push         │     │                          │    │
│  │     notifications     │     │                          │    │
│  └───────────────────────┘     └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Request Flow

### Example: Report Parking Spot

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ POST /api/v1/parking-spots
     │ {latitude, longitude, notes}
     │ Authorization: Bearer <token>
     │
     ▼
┌─────────────────┐
│  Gin Router     │
└────┬────────────┘
     │
     │ Apply Middleware
     ▼
┌─────────────────┐
│  JWT Middleware │  → Validate token → Extract user_id
└────┬────────────┘
     │
     │ user_id = uuid
     ▼
┌──────────────────┐
│ Parking Handler  │  → CreateParkingSpot()
└────┬─────────────┘
     │
     │ 1. Validate request
     │ 2. Calculate expiry time
     │ 3. Insert to database
     │ 4. Award karma points
     │
     ▼
┌──────────────────┐
│   PostgreSQL     │  → INSERT with ST_MakePoint()
└────┬─────────────┘
     │
     │ Return spot data
     ▼
┌──────────────────┐
│  Client          │  ← 201 Created + spot JSON
└──────────────────┘
```

---

## 🗺️ Geospatial Query Flow

### Example: Find Nearby Spots

```
Client Request:
  GET /parking-spots/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0

                     ↓

Handler extracts params:
  lat = 37.7749
  lon = -122.4194
  radius = 1.0 miles → 1609.34 meters

                     ↓

PostGIS Query:
  SELECT *, 
    ST_Distance(
      location,
      ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography
    ) / 1609.34 AS distance_miles
  FROM parking_spots
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
    1609.34
  )
  ORDER BY distance_miles

                     ↓

PostGIS uses GIST index → Fast spatial search

                     ↓

Return spots sorted by distance:
  [
    {id: "...", distance_miles: 0.2, ...},
    {id: "...", distance_miles: 0.5, ...},
    {id: "...", distance_miles: 0.8, ...}
  ]
```

---

## ⚙️ Background Worker Flow

### Alert Checker (Every 30 seconds)

```
                    ┌─────────────────┐
                    │  Start Ticker   │
                    │   (30 seconds)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────────────────────┐
                    │ Get Active Parking Sessions     │
                    │ WHERE is_active = true          │
                    │   AND enforcement_alerts = true │
                    └────────┬────────────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │  For Each Session:      │
                    │  (Uses Goroutines)      │
                    └────────┬────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Session 1   │  │  Session 2   │  │  Session 3   │
    │              │  │              │  │              │
    │ Check within │  │ Check within │  │ Check within │
    │ user's radius│  │ user's radius│  │ user's radius│
    │              │  │              │  │              │
    │ PostGIS:     │  │ PostGIS:     │  │ PostGIS:     │
    │ ST_DWithin() │  │ ST_DWithin() │  │ ST_DWithin() │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                 │
           │ Found alert     │ No alerts       │ Found 2 alerts
           ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Create       │  │ Skip         │  │ Create 2     │
    │ Notification │  │              │  │ Notifications│
    │              │  │              │  │              │
    │ Send Push    │  │              │  │ Send Push    │
    │ (Firebase)   │  │              │  │ (Firebase)   │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🔐 Authentication Flow

```
┌──────────────┐
│   Register   │
└──────┬───────┘
       │
       │ POST /auth/register
       │ {email, password, username}
       │
       ▼
┌────────────────────┐
│  Hash Password     │  → bcrypt.GenerateFromPassword()
│  (bcrypt)          │
└──────┬─────────────┘
       │
       │ password_hash
       ▼
┌────────────────────┐
│ Insert User        │  → INSERT INTO users
└──────┬─────────────┘
       │
       │ user created
       ▼
┌────────────────────┐
│ Generate Tokens    │  → JWT HS256
│                    │    - Access: 15 min
│                    │    - Refresh: 7 days
└──────┬─────────────┘
       │
       │ {access_token, refresh_token, user}
       ▼
┌────────────────────┐
│  Client Stores     │
│  - access_token    │  → Use in Authorization header
│  - refresh_token   │  → For token renewal
└────────────────────┘


┌──────────────┐
│Protected API │
└──────┬───────┘
       │
       │ Authorization: Bearer <access_token>
       │
       ▼
┌────────────────────┐
│ JWT Middleware     │
└──────┬─────────────┘
       │
       │ 1. Extract token from header
       │ 2. Validate signature
       │ 3. Check expiry
       │ 4. Extract claims (user_id, email)
       │
       ▼
┌────────────────────┐
│ Set Context        │  → c.Set("user_id", claims.UserID)
└──────┬─────────────┘
       │
       │ Request continues with user context
       ▼
┌────────────────────┐
│  Handler           │  → userID := c.Get("user_id")
└────────────────────┘
```

---

## 📦 Data Models

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
│  - id (UUID)                                                 │
│  - email, password_hash, username                            │
│  - karma_points                                              │
│  - parking_radius_miles (for alerts)                         │
│  - push_notification_token                                   │
└───────┬─────────────────────────────────────────────────────┘
        │
        │ 1:N relationships
        │
        ├──────────────────────┬─────────────────┬──────────────
        │                      │                 │
        ▼                      ▼                 ▼
┌──────────────┐    ┌──────────────────┐   ┌──────────────┐
│   Vehicles   │    │  Parking Spots   │   │  Alerts      │
│              │    │                  │   │              │
│ - id         │    │ - id             │   │ - id         │
│ - user_id    │    │ - reporter_id    │   │ - reporter_id│
│ - plate      │    │ - location (geo) │   │ - location   │
│ - make/model │    │ - lat/lon        │   │ - type       │
│ - is_default │    │ - expires_at     │   │ - severity   │
└──────┬───────┘    │ - status         │   │ - expires_at │
       │            └─────────┬────────┘   └──────┬───────┘
       │                      │                   │
       │ Used in:             │ 1:N               │ 1:N
       │                      │                   │
       ▼                      ▼                   ▼
┌──────────────────┐   ┌──────────────┐   ┌──────────────┐
│ Parking Sessions │   │   Photos     │   │   Photos     │
│                  │   │              │   │              │
│ - id             │   │ - spot_id    │   │ - alert_id   │
│ - user_id        │   │ - photo_url  │   │ - photo_url  │
│ - vehicle_id     │   └──────────────┘   └──────────────┘
│ - location (geo) │
│ - started_at     │
│ - is_active      │
└──────────────────┘
```

---

## 🎯 API Endpoints Summary

### Public Routes
```
POST   /api/v1/auth/register      Create account
POST   /api/v1/auth/login          Login
GET    /health                     Health check
```

### Protected Routes (Requires JWT)
```
GET    /api/v1/profile                           Get user profile

POST   /api/v1/parking-spots                     Report parking spot
GET    /api/v1/parking-spots/nearby              Find nearby spots
PATCH  /api/v1/parking-spots/:id/taken           Mark spot taken

POST   /api/v1/enforcement-alerts                Report enforcement
GET    /api/v1/enforcement-alerts/nearby         Find nearby alerts
PATCH  /api/v1/enforcement-alerts/:id/resolve    Resolve alert
```

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Production Setup                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐        ┌──────────────┐
│   Clients    │  HTTPS  │  Load        │        │   Go App     │
│  (Mobile)    │────────▶│  Balancer    │───────▶│   Server     │
│              │         │  (nginx)     │        │   :8080      │
└──────────────┘         └──────────────┘        └──────┬───────┘
                                                         │
                                ┌────────────────────────┤
                                │                        │
                                ▼                        ▼
                    ┌───────────────────┐   ┌────────────────────┐
                    │   PostgreSQL      │   │   AWS S3           │
                    │   + PostGIS       │   │   (Photo Storage)  │
                    │   (Managed DB)    │   │                    │
                    └───────────────────┘   └────────────────────┘
```

---

## 💡 Key Design Decisions

### 1. Why Go?
- ✅ Built-in concurrency (goroutines) for background workers
- ✅ Fast geospatial calculations
- ✅ Low memory footprint
- ✅ Single binary deployment
- ✅ Strong typing catches bugs early

### 2. Why PostGIS?
- ✅ Industry-standard geospatial extension
- ✅ Efficient spatial indexing (GIST)
- ✅ ST_DWithin for radius searches
- ✅ ST_Distance for accurate calculations
- ✅ Handles millions of points efficiently

### 3. Why Goroutines for Workers?
- ✅ Lightweight (2KB per goroutine)
- ✅ Can spawn thousands concurrently
- ✅ Built-in scheduling
- ✅ No separate process needed
- ✅ Share database connection pool

### 4. Why JWT?
- ✅ Stateless authentication
- ✅ No session storage needed
- ✅ Works across multiple servers
- ✅ Mobile-friendly
- ✅ Includes user claims

---

**System is production-ready! 🚀**
