# 🚀 Park-Opticon Go Backend

**High-performance geospatial backend for the Park-Opticon mobile app**

Built with Go, PostgreSQL + PostGIS, and Gin framework.

---

## 🎯 Features

- ✅ **RESTful API** with JWT authentication
- ✅ **PostGIS geospatial queries** for nearby spots/alerts
- ✅ **Background workers** (goroutines) for alert checking
- ✅ **Auto-expiration** of parking spots and enforcement alerts
- ✅ **Karma system** for community contributions
- ✅ **Rate limiting** and security best practices
- ✅ **Clean architecture** with handlers, models, middleware

---

## 📁 Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go                 # Application entry point
├── internal/
│   ├── auth/
│   │   └── jwt.go                  # JWT token generation/validation
│   ├── config/
│   │   └── config.go               # Configuration loader
│   ├── database/
│   │   ├── database.go             # Database connection
│   │   └── migrations.go           # SQL migrations
│   ├── handlers/
│   │   ├── auth.go                 # Auth endpoints (register/login)
│   │   ├── parking.go              # Parking spot endpoints
│   │   └── enforcement.go          # Enforcement alert endpoints
│   ├── middleware/
│   │   └── auth.go                 # JWT & CORS middleware
│   ├── models/
│   │   └── models.go               # Data models/structs
│   ├── router/
│   │   └── router.go               # API routes
│   └── worker/
│       ├── alert_checker.go        # Background alert checker
│       └── expiry_checker.go       # Expire old spots/alerts
├── .env.example                    # Environment variables template
├── .gitignore
├── go.mod
└── README.md
```

---

## 🛠️ Prerequisites

1. **Go 1.21+**
   - Download from [golang.org](https://golang.org/dl/)

2. **PostgreSQL 14+ with PostGIS**
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - Or use Docker: `docker run --name parkopticon-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgis/postgis`

3. **Git** (for cloning the repo)

---

## ⚡ Quick Start

### 1. Install PostgreSQL with PostGIS

**Using Docker (easiest):**
```powershell
docker run --name parkopticon-db `
  -e POSTGRES_USER=parkopticon `
  -e POSTGRES_PASSWORD=your_password `
  -e POSTGRES_DB=parkopticon_db `
  -p 5432:5432 `
  -d postgis/postgis:latest
```

**Or install locally:**
- Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/)
- Install PostGIS extension: `CREATE EXTENSION postgis;`

### 2. Set Up Environment Variables

```powershell
cd backend
cp .env.example .env
```

Edit `.env` and update database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=parkopticon
DB_PASSWORD=your_password
DB_NAME=parkopticon_db

JWT_SECRET=change_this_to_a_random_secret_string
```

### 3. Install Dependencies

```powershell
go mod download
```

### 4. Run the Server

```powershell
go run cmd/server/main.go
```

You should see:
```
✅ Database connected successfully
✅ Database migrations completed
✅ Background alert checker started
✅ Background expiry checker started
🚀 Server starting on :8080 (ENV: development)
```

### 5. Test the API

**Health check:**
```powershell
curl http://localhost:8080/health
```

**Register a user:**
```powershell
curl -X POST http://localhost:8080/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "username": "testuser",
    "full_name": "Test User"
  }'
```

**Login:**
```powershell
curl -X POST http://localhost:8080/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Copy the `access_token` from the response and use it for authenticated requests.

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create new account |
| POST | `/api/v1/auth/login` | Login and get tokens |
| GET | `/api/v1/profile` | Get current user profile |

### Parking Spots

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/parking-spots` | Report a parking spot | ✅ |
| GET | `/api/v1/parking-spots/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0` | Get nearby spots | ✅ |
| PATCH | `/api/v1/parking-spots/:id/taken` | Mark spot as taken | ✅ |

### Enforcement Alerts

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/enforcement-alerts` | Report enforcement activity | ✅ |
| GET | `/api/v1/enforcement-alerts/nearby?latitude=37.7749&longitude=-122.4194&radius_miles=1.0` | Get nearby alerts | ✅ |
| PATCH | `/api/v1/enforcement-alerts/:id/resolve` | Mark alert as resolved | ✅ |

---

## 🔐 Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <your_access_token>
```

**Token expiry:**
- Access token: 1 hour
- Refresh token: 7 days

---

## 🧩 Background Workers

### Alert Checker (Every 30 seconds)
- Finds active parking sessions
- Checks for new enforcement alerts within user's radius
- Sends push notifications to affected users
- Uses goroutines for parallel processing

### Expiry Checker (Every 5 minutes)
- Expires old parking spots (past `expires_at`)
- Expires old enforcement alerts (past `expires_at`)
- Keeps database clean

---

## 🗄️ Database Schema

See `DATABASE_SCHEMA.md` in the project root for the complete schema.

**Key tables:**
- `users` - User accounts and settings
- `vehicles` - User vehicles
- `parking_spots` - Crowdsourced parking availability
- `enforcement_alerts` - Officer/towing reports
- `parking_sessions` - Active parking with geofencing
- `tickets` - User parking tickets
- `notifications` - Push notification history

---

## 🚀 Production Deployment

### Build the Binary

```powershell
# Windows
$env:GOOS="windows"; $env:GOARCH="amd64"; go build -o bin/server.exe cmd/server/main.go

# Linux
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o bin/server cmd/server/main.go
```

### Deploy to Cloud

**Option 1: Docker**
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o server cmd/server/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/server .
COPY --from=builder /app/.env .
EXPOSE 8080
CMD ["./server"]
```

**Option 2: Cloud Run / App Engine**
- Upload binary
- Set environment variables
- Configure PostgreSQL connection

---

## 🧪 Testing

```powershell
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/auth
```

---

## 📊 Performance

**Why Go is great for Park-Opticon:**

1. **Goroutines** - Check 10,000 parking sessions in parallel
2. **Low latency** - Geospatial queries return in <50ms
3. **Memory efficient** - ~20MB base memory vs Node's 50-100MB
4. **Compiled binary** - Single file deployment, no dependencies
5. **Built-in concurrency** - Perfect for background workers

---

## 🔮 TODO / Roadmap

- [ ] Add parking session endpoints (start/end session)
- [ ] Add ticket CRUD endpoints
- [ ] Add vehicle CRUD endpoints
- [ ] Implement S3 photo upload
- [ ] Add Firebase Cloud Messaging for push notifications
- [ ] Add rate limiting middleware
- [ ] Add request logging
- [ ] Add Prometheus metrics
- [ ] Write unit tests
- [ ] Add Swagger/OpenAPI documentation
- [ ] Add WebSocket support for real-time updates

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License - see LICENSE file for details

---

## 💡 Tips

**Hot reload during development:**
```powershell
# Install air
go install github.com/cosmtrek/air@latest

# Run with auto-reload
air
```

**View database:**
```powershell
# Connect to PostgreSQL
psql -h localhost -U parkopticon -d parkopticon_db

# List tables
\dt

# Query users
SELECT * FROM users;
```

**Check geospatial data:**
```sql
-- View parking spots with distance
SELECT 
  id, latitude, longitude,
  ST_AsText(location) as location_wkt
FROM parking_spots
LIMIT 5;
```

---

**Ready to build something amazing! 🚀**

For frontend integration, see the React Native app in `../parkopticon/`.
