# 🧪 API Testing Guide

Quick reference for testing Park-Opticon backend endpoints.

---

## 🔧 Setup

**Base URL:** `http://localhost:8080`

**Headers for authenticated requests:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 1️⃣ Authentication

### Register New User

```powershell
curl -X POST http://localhost:8080/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "john@example.com",
    "password": "password123",
    "username": "johndoe",
    "full_name": "John Doe"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "username": "johndoe",
    "karma_points": 0
  }
}
```

### Login

```powershell
curl -X POST http://localhost:8080/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get Profile

```powershell
curl http://localhost:8080/api/v1/profile `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 2️⃣ Parking Spots

### Report a Parking Spot

```powershell
curl -X POST http://localhost:8080/api/v1/parking-spots `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "Market St & 5th St, San Francisco",
    "street_name": "Market St",
    "spot_type": "street",
    "duration_estimate": 60,
    "notes": "Spot right in front of coffee shop"
  }'
```

### Get Nearby Parking Spots

```powershell
# San Francisco coordinates
curl "http://localhost:8080/api/v1/parking-spots/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Mark Spot as Taken

```powershell
curl -X PATCH http://localhost:8080/api/v1/parking-spots/SPOT_ID/taken `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 3️⃣ Enforcement Alerts

### Report Enforcement Activity

```powershell
curl -X POST http://localhost:8080/api/v1/enforcement-alerts `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "Valencia St & 16th St",
    "street_name": "Valencia St",
    "enforcement_type": "ticketing",
    "description": "Officer writing tickets for expired meters",
    "severity": "high"
  }'
```

**Enforcement Types:**
- `ticketing` - Officer writing tickets
- `chalking` - Tire chalking for time limit enforcement
- `towing` - Tow truck spotted

**Severity:**
- `low` - Single officer, routine patrol
- `medium` - Active enforcement
- `high` - Multiple officers, aggressive ticketing

### Get Nearby Enforcement Alerts

```powershell
# All types
curl "http://localhost:8080/api/v1/enforcement-alerts/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by type
curl "http://localhost:8080/api/v1/enforcement-alerts/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0&type=ticketing" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Resolve Enforcement Alert

```powershell
curl -X PATCH http://localhost:8080/api/v1/enforcement-alerts/ALERT_ID/resolve `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🧪 Testing Workflow

### Complete Test Scenario

```powershell
# 1. Register
$response = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/auth/register" `
  -ContentType "application/json" `
  -Body '{"email":"test@test.com","password":"password123","username":"testuser"}'

$token = $response.access_token
Write-Host "Token: $token"

# 2. Report a parking spot
$spot = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/parking-spots" `
  -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json" `
  -Body '{"latitude":37.7749,"longitude":-122.4194,"notes":"Test spot"}'

Write-Host "Created spot: $($spot.id)"

# 3. Find nearby spots
$nearby = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/parking-spots/nearby?latitude=37.7749&longitude=-122.4194" `
  -Headers @{Authorization="Bearer $token"}

Write-Host "Found $($nearby.count) spots"

# 4. Report enforcement
$alert = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/enforcement-alerts" `
  -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json" `
  -Body '{"latitude":37.7749,"longitude":-122.4194,"enforcement_type":"ticketing","description":"Test alert","severity":"high"}'

Write-Host "Created alert: $($alert.id)"

# 5. Check profile (should have karma points now)
$profile = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/profile" `
  -Headers @{Authorization="Bearer $token"}

Write-Host "Karma points: $($profile.karma_points)"
```

---

## 📍 Test Locations

Use these coordinates for testing:

**San Francisco:**
- Downtown: `37.7749, -122.4194`
- Mission District: `37.7599, -122.4148`
- Financial District: `37.7946, -122.3999`

**New York:**
- Times Square: `40.7580, -73.9855`
- Central Park: `40.7829, -73.9654`

**Los Angeles:**
- Downtown: `34.0522, -118.2437`
- Hollywood: `34.0928, -118.3287`

---

## 🔍 Debugging Tips

### Check server logs
Look for these messages:
- `✅ Database connected successfully`
- `✅ Background alert checker started`
- `📱 Would send push notification...`

### Test geospatial queries directly

```sql
-- Connect to database
psql -h localhost -U parkopticon -d parkopticon_db

-- Check parking spots
SELECT id, latitude, longitude, status, created_at
FROM parking_spots
ORDER BY created_at DESC
LIMIT 5;

-- Find spots near a point
SELECT 
  id, 
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
ORDER BY distance_miles;
```

---

## 🚨 Common Issues

**401 Unauthorized:**
- Token expired (access tokens last 15 minutes)
- Invalid token format
- Missing `Bearer` prefix

**400 Bad Request:**
- Missing required fields
- Invalid JSON format
- Invalid latitude/longitude values

**500 Internal Server Error:**
- Database connection failed
- PostGIS extension not enabled
- Check server logs

---

## 📊 Rate Limits

- Report parking spot: 10 per hour
- Report enforcement: 20 per hour
- API requests: 100 per minute per user

---

**Ready to test! 🚀**
