# Park-Opticon Backend - Mock Mode Guide

## Overview

The Park-Opticon backend now supports **two operational modes**:

### 1. **Mock Mode** (Test/Development)
- ✅ No database required
- ✅ Serves immutable sample data
- ✅ Perfect for frontend development
- ✅ Perfect for testing UI components
- ✅ Fast startup (~instant)
- ⚠️  All POST/PATCH requests return success but don't persist data

### 2. **Full Mode** (Production/Development)
- ✅ Full PostgreSQL + PostGIS database
- ✅ All CRUD operations persist
- ✅ Background workers for alerts/expiration
- ✅ Production-ready

---

## Quick Start

### Start in Mock Mode (No Database)
```bash
cd backend
export PATH=$PATH:/usr/local/go/bin
go run cmd/server/main.go --mock
```

You should see:
```
🧪 Starting in MOCK MODE - Serving immutable test data
📝 No database connection required
⚠️  All changes are temporary and will not be persisted
✅ Mock handlers initialized
📊 Mock data loaded:
   - Users: 2
   - Parking Spots: 4
   - Enforcement Alerts: 3
   - Vehicles: 2
   - Parking Sessions: 1
   - Tickets: 2
🌐 Server starting on :8080 (MODE: MOCK, ENV: development)
```

### Start in Full Mode (With Database)
```bash
cd backend
export PATH=$PATH:/usr/local/go/bin
go run cmd/server/main.go
```

---

## Mock Data Available

### Users
- **Email:** `demo@parkopticon.com` / Password: any (mock accepts all)
- **Email:** `john@example.com` / Password: any

### Parking Spots (San Francisco)
- 4 available spots around Market St, Mission St, Howard St, Valencia St
- Mix of street parking and garage
- Various duration estimates (60-240 minutes)
- Different verification counts

### Enforcement Alerts
- Parking enforcement officer on Market St (medium severity)
- Tow truck on Mission St (high severity)  
- Street sweeping on Valencia St (low severity)

### Vehicles
- Honda Civic 2020 (CA - ABC1234)
- Ford F-150 2019 (CA - XYZ9876)

### Parking Sessions
- 1 active session on Market St (45 minutes ago)

### Tickets
- $75 expired meter ticket (unpaid)
- $50 street sweeping ticket (paid)

---

## Testing the API

### Health Check
```bash
curl http://localhost:8080/health
```

**Response:**
```json
{
  "status": "ok",
  "mode": "mock",
  "message": "Park-Opticon API (Mock Mode - Immutable Test Data)",
  "database": "inmemory",
  "users": 2,
  "spots": 4,
  "alerts": 3,
  "vehicles": 2,
  "sessions": 1,
  "tickets": 2
}
```

### Register/Login (Mock)
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@parkopticon.com", "password": "any"}'
```

**Response:**
```json
{
  "message": "Login successful (mock)",
  "user": {...},
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Get Nearby Parking Spots (Mock)
```bash
TOKEN="your_access_token_here"
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/parking-spots/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0"
```

**Response:**
```json
{
  "spots": [
    {
      "id": "323e4567-e89b-12d3-a456-426614174002",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "address": "123 Market St, San Francisco, CA",
      "street_name": "Market Street",
      "spot_type": "street",
      "duration_estimate": 120,
      "notes": "Easy parallel parking spot",
      "status": "available",
      "verified_by_count": 3,
      "distance_miles": 0.2
    },
    ...
  ],
  "count": 4
}
```

### Get Enforcement Alerts (Mock)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/enforcement-alerts/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0"
```

### Get User's Tickets (Mock)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/tickets"
```

### Report Parking Spot (Mock - Not Persisted)
```bash
curl -X POST http://localhost:8080/api/v1/parking-spots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.7800,
    "longitude": -122.4150,
    "address": "456 New St, San Francisco, CA",
    "street_name": "New Street",
    "spot_type": "street",
    "duration_estimate": 90,
    "notes": "Great spot!"
  }'
```

**Response:**
```json
{
  "message": "Parking spot reported (mock - not persisted)",
  "spot": {
    "id": "new-uuid",
    "latitude": 37.7800,
    "longitude": -122.4150,
    ...
  }
}
```

---

## When to Use Each Mode

### Use Mock Mode When:
- ✅ Developing frontend UI
- ✅ Testing mobile app without backend setup
- ✅ Demoing the app
- ✅ Running integration tests
- ✅ Quick prototyping
- ✅ No database available
- ✅ CI/CD testing

### Use Full Mode When:
- ✅ Testing actual data persistence
- ✅ Testing background workers
- ✅ Testing geospatial queries
- ✅ Load testing
- ✅ Production deployment
- ✅ Developing backend features

---

## Building & Running

### Build Binary
```bash
# Mock mode binary
go build -o bin/server-mock -tags mock cmd/server/main.go

# Full mode binary
go build -o bin/server cmd/server/main.go
```

### Run Binary
```bash
# Mock mode
./bin/server-mock --mock

# Full mode
./bin/server
```

---

## Environment Variables

Mock mode doesn't require database environment variables, but needs JWT secret:

```env
# Minimum for mock mode
JWT_SECRET=your_jwt_secret_key
SERVER_PORT=8080
SERVER_ENV=development

# Only needed for full mode
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=parkopticon_db
```

---

## Integration with React Native

### Configure API Base URL

In your React Native app:

```javascript
// config/api.js
const API_BASE_URL = __DEV__ 
  ? 'http://100.81.234.39:8080/api/v1'  // Your Tailscale IP
  : 'https://api.parkopticon.com/api/v1';

export default API_BASE_URL;
```

### Test Connection
```javascript
import API_BASE_URL from './config/api';

// Test health endpoint
fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`)
  .then(res => res.json())
  .then(data => console.log('Backend mode:', data.mode));
```

---

## Advantages of Mock Mode

1. **No Setup Required** - Start coding immediately
2. **Consistent Data** - Same test data every time
3. **Fast** - No database overhead
4. **Portable** - Works on any machine
5. **Safe** - Can't break production data
6. **Predictable** - Perfect for UI testing
7. **Offline** - Works without internet

---

## Makefile Commands (Optional)

Create a `Makefile` in backend/:

```makefile
.PHONY: mock full build test

mock:
	go run cmd/server/main.go --mock

full:
	go run cmd/server/main.go

build:
	go build -o bin/server cmd/server/main.go

test:
	go test ./...

install:
	go mod download
```

Usage:
```bash
make mock   # Start in mock mode
make full   # Start in full mode
make build  # Build binary
```

---

## Switching Between Modes

You can switch modes by simply restarting the server with or without the `--mock` flag:

```bash
# Currently running in mock mode
^C  # Stop server

# Start in full mode
go run cmd/server/main.go

# Or vice versa
^C
go run cmd/server/main.go --mock
```

---

## Summary

| Feature | Mock Mode | Full Mode |
|---------|-----------|-----------|
| Database | ❌ Not required | ✅ PostgreSQL + PostGIS |
| Data Persistence | ❌ Temporary | ✅ Permanent |
| Background Workers | ❌ Disabled | ✅ Enabled |
| Startup Time | ⚡ Instant | 🐢 2-3 seconds |
| Use Case | Frontend Dev, Testing | Production, Backend Dev |
| Data | Fixed/Immutable | Dynamic/CRUD |

---

**Happy developing! 🚀**

For production deployment, see `DOCKER_DEPLOYMENT.md`
