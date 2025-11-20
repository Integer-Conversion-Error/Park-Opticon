# Backend Setup Complete! 🎉

## Installation Summary

### ✅ Prerequisites Installed

1. **Go 1.21.13**
   - Installed at: `/usr/local/go`
   - Added to PATH in `~/.bashrc`
   - Verify: `go version`

2. **PostgreSQL 14 with PostGIS**
   - Database created: `parkopticon_db`
   - PostGIS extension enabled
   - User: `postgres` / Password: `postgres`
   - Port: `5432`

3. **Go Dependencies**
   - All modules downloaded via `go mod download`
   - Ready to build and run

---

## 🎯 Two Operational Modes

### Mock Mode (Test/Development)
```bash
cd /root/Projects/Park-Opticon/backend
./start.sh mock
```
**Or:**
```bash
go run cmd/server/main.go --mock
```

**Features:**
- ✅ No database required
- ✅ Immutable test data
- ✅ Instant startup
- ✅ Perfect for frontend development
- ✅ Sample data included:
  - 2 users
  - 4 parking spots (San Francisco)
  - 3 enforcement alerts
  - 2 vehicles
  - 1 active parking session
  - 2 tickets

### Full Mode (Production)
```bash
cd /root/Projects/Park-Opticon/backend
./start.sh full
```
**Or:**
```bash
go run cmd/server/main.go
```

**Features:**
- ✅ Full PostgreSQL + PostGIS
- ✅ Data persistence
- ✅ Background workers
- ✅ Geospatial queries
- ✅ Production-ready

---

## 📂 New Files Created

### Core Mock System
1. `internal/mockdata/data.go` - Sample data (users, spots, alerts, etc.)
2. `internal/mockhandlers/handlers.go` - Mock request handlers
3. `internal/mockrouter/router.go` - Mock routing setup

### Configuration & Scripts
4. `.env` - Environment variables (database, JWT secret)
5. `start.sh` - Quick startup script for both modes
6. `MOCK_MODE_GUIDE.md` - Complete documentation

### Binary
7. `bin/server` - Compiled Go binary

---

## 🚀 Quick Start Commands

### Test Mock Mode
```bash
cd /root/Projects/Park-Opticon/backend
export PATH=$PATH:/usr/local/go/bin
go run cmd/server/main.go --mock
```

Expected output:
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

### Test Full Mode
```bash
cd /root/Projects/Park-Opticon/backend
export PATH=$PATH:/usr/local/go/bin
go run cmd/server/main.go
```

Expected output:
```
🚀 Starting in FULL MODE - Database-backed operation
✅ Database connected successfully
✅ Database migrations completed
✅ Background alert checker started
✅ Background expiry checker started
🌐 Server starting on :8080 (MODE: FULL, ENV: development)
```

---

## 🧪 Testing the API

### Health Check (Mock Mode)
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
  "tickets": 2,
  "timestamp": "2025-11-09T01:52:30.123Z"
}
```

### Login (Mock Mode)
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@parkopticon.com", "password": "test"}'
```

### Get Parking Spots (Mock Mode)
```bash
# Get token from login response
TOKEN="your_access_token_here"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/parking-spots/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0"
```

---

## 📡 API Endpoints Available

### Public Endpoints
- `GET /health` - Health check
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login

### Protected Endpoints (Require JWT)
- `GET /api/v1/profile` - Get user profile
- `GET /api/v1/parking-spots/nearby` - Get nearby parking spots
- `POST /api/v1/parking-spots` - Report a parking spot
- `PATCH /api/v1/parking-spots/:id/taken` - Mark spot as taken
- `GET /api/v1/enforcement-alerts/nearby` - Get nearby enforcement alerts
- `POST /api/v1/enforcement-alerts` - Report enforcement activity
- `PATCH /api/v1/enforcement-alerts/:id/resolve` - Resolve alert
- `GET /api/v1/vehicles` - Get user's vehicles
- `GET /api/v1/parking-sessions` - Get user's parking sessions
- `GET /api/v1/tickets` - Get user's tickets

---

## 🔧 Configuration

### Environment Variables (`.env`)
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=parkopticon_db
DB_SSLMODE=disable

# Server
SERVER_PORT=8080
SERVER_ENV=development

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_123456789

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,exp://localhost:8081
```

**Note:** Mock mode only needs `JWT_SECRET`, `SERVER_PORT`, and `SERVER_ENV`

---

## 🌐 Connecting from React Native (via Tailscale)

Your server is accessible at:
```
http://100.81.234.39:8080
```

### Update React Native config:
```javascript
// config/api.js
const API_BASE_URL = 'http://100.81.234.39:8080/api/v1';
export default API_BASE_URL;
```

### Test from your PC:
```bash
# From your Tailscale-connected PC
curl http://100.81.234.39:8080/health
```

---

## 📊 Mock Data Details

### Users
| Email | Username | Karma Points |
|-------|----------|--------------|
| demo@parkopticon.com | demo_user | 150 |
| john@example.com | john_parker | 75 |

**Login:** Use any email above with any password in mock mode

### Parking Spots (San Francisco)
1. **Market Street** - 37.7749, -122.4194 - Street parking, 2hr
2. **Mission Street** - 37.7833, -122.4167 - Metered, 1hr  
3. **Howard Street** - 37.7899, -122.4100 - Garage, $15/hr
4. **Valencia Street** - 37.7700, -122.4250 - Free after 6pm

### Enforcement Alerts
1. **Market St** - Parking enforcement (medium severity)
2. **Mission St** - Tow truck active (high severity)
3. **Valencia St** - Street sweeping (low severity)

### Vehicles
1. Honda Civic 2020 (CA - ABC1234)
2. Ford F-150 2019 (CA - XYZ9876)

### Tickets
1. $75.00 - Expired meter (unpaid)
2. $50.00 - Street sweeping (paid)

---

## 🛠️ Development Workflow

### Typical Workflow
1. **Frontend development:** Use mock mode
   ```bash
   ./start.sh mock
   ```

2. **Backend development:** Use full mode
   ```bash
   ./start.sh full
   ```

3. **Build binary:**
   ```bash
   go build -o bin/server cmd/server/main.go
   ```

4. **Run binary:**
   ```bash
   ./bin/server --mock  # Mock mode
   ./bin/server         # Full mode
   ```

---

## 🔍 Verifying Installation

### Check Go
```bash
go version
# Should show: go version go1.21.13 linux/amd64
```

### Check PostgreSQL
```bash
sudo systemctl status postgresql
# Should show: Active: active (running)
```

### Check Database
```bash
sudo -u postgres psql -d parkopticon_db -c "SELECT postgis_version();"
# Should show PostGIS version
```

### Build Backend
```bash
cd /root/Projects/Park-Opticon/backend
go build -o bin/server cmd/server/main.go
# Should complete without errors
```

---

## 📝 Documentation Files

- `README.md` - Main backend documentation
- `MOCK_MODE_GUIDE.md` - Detailed mock mode guide
- `API_TESTING.md` - API testing examples
- `ARCHITECTURE.md` - System architecture
- `DATABASE_SCHEMA.md` - Database schema (in project root)

---

## 🎯 Next Steps

### For Frontend Development
1. Start backend in mock mode: `./start.sh mock`
2. Configure React Native to use: `http://100.81.234.39:8080/api/v1`
3. Start Expo: `cd ../parkopticon && npm start`
4. Test login with: `demo@parkopticon.com` / any password

### For Backend Development
1. Start in full mode: `./start.sh full`
2. Database is ready at `localhost:5432`
3. Add new endpoints to `internal/handlers/`
4. Update routes in `internal/router/router.go`

### For Production Deployment
1. Update `.env` with production values
2. Build binary: `go build -o bin/server cmd/server/main.go`
3. Run: `./bin/server` (full mode)
4. Or use Docker: See `DOCKER_DEPLOYMENT.md`

---

## 🐛 Troubleshooting

### "go: command not found"
```bash
export PATH=$PATH:/usr/local/go/bin
# Or restart terminal
```

### "Failed to connect to database"
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Check if running
sudo systemctl status postgresql
```

### "Port 8080 already in use"
```bash
# Find process
lsof -i :8080

# Kill it
kill -9 <PID>
```

### Mock mode not working
```bash
# Make sure you're using the --mock flag
go run cmd/server/main.go --mock

# Check health endpoint
curl http://localhost:8080/health
# Should show "mode": "mock"
```

---

## 📚 Additional Resources

### Official Docs
- Go: https://golang.org/doc/
- Gin Framework: https://gin-gonic.com/docs/
- PostgreSQL: https://www.postgresql.org/docs/
- PostGIS: https://postgis.net/documentation/

### Project Repos
- Frontend: `/root/Projects/Park-Opticon/parkopticon`
- Backend: `/root/Projects/Park-Opticon/backend`

---

## ✅ Installation Checklist

- [x] Go 1.21.13 installed
- [x] PostgreSQL 14 installed
- [x] PostGIS extension enabled
- [x] Database `parkopticon_db` created
- [x] Go dependencies installed
- [x] Mock data module created
- [x] Mock handlers implemented
- [x] Mock router created
- [x] Main.go updated with mode selection
- [x] Environment file created
- [x] Startup script created
- [x] Documentation written
- [x] Mock mode tested
- [x] Binary builds successfully

---

**🎉 Backend is fully operational in both mock and full modes!**

**Quick commands:**
```bash
# Mock mode (no database)
cd /root/Projects/Park-Opticon/backend && ./start.sh mock

# Full mode (with database)
cd /root/Projects/Park-Opticon/backend && ./start.sh full

# Test health
curl http://localhost:8080/health
```

Happy coding! 🚀
