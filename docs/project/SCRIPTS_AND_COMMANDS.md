# Park-Opticon - Complete Scripts & Commands Documentation

**Version:** 1.0  
**Last Updated:** November 12, 2025  
**Author:** Park-Opticon Team

This document provides exhaustive documentation for all scripts, commands, and automation tools in the Park-Opticon project.

---

## Table of Contents

1. [Backend Scripts](#backend-scripts)
   - [Shell Scripts (Linux/macOS)](#shell-scripts-linuxmacos)
   - [PowerShell Scripts (Windows)](#powershell-scripts-windows)
   - [Python Scripts](#python-scripts)
2. [Makefile Commands](#makefile-commands)
3. [Docker Commands](#docker-commands)
4. [NPM Scripts](#npm-scripts)
   - [Admin Portal](#admin-portal-scripts)
   - [Mobile App (Expo)](#mobile-app-expo-scripts)
5. [Database Scripts](#database-scripts)
6. [Development Workflows](#development-workflows)
7. [Deployment Workflows](#deployment-workflows)
8. [Troubleshooting Commands](#troubleshooting-commands)

---

## Backend Scripts

### Shell Scripts (Linux/macOS)

#### 1. `backend/start.sh`

**Purpose:** Starts the Park-Opticon backend server in either mock mode or full database mode.

**Location:** `/backend/start.sh`

**Usage:**
```bash
./start.sh [mode]
```

**Modes:**
- `mock` - Starts server with in-memory test data (no database required)
- `full` - Starts server with PostgreSQL database (default)

**Features:**
- Automatically adds Go to PATH
- Checks PostgreSQL status and starts it if needed (full mode only)
- Provides clear status messages with emojis
- Validates mode input

**Examples:**
```bash
# Start in full mode (default)
./start.sh
./start.sh full

# Start in mock mode (for frontend development)
./start.sh mock
```

**Prerequisites:**
- Go 1.21+ installed
- PostgreSQL running (full mode only)
- Proper database configuration in `.env` file (full mode only)

**Exit Codes:**
- `0` - Success
- `1` - Invalid mode provided

---

#### 2. `backend/rebuild.sh`

**Purpose:** Rebuilds the backend binary and restarts the running server process.

**Location:** `/backend/rebuild.sh`

**Usage:**
```bash
./rebuild.sh
```

**What it does:**
1. Builds new binary: `go build -o parkopticon cmd/server/main.go`
2. Stops existing parkopticon process (if running)
3. Starts the new binary in background
4. Provides log viewing command

**Features:**
- Non-destructive: Won't kill SSH/SSHD processes
- Provides immediate feedback on build status
- Runs server in background
- Shows how to view logs

**Output:**
```
🔨 Rebuilding backend...
✅ Build successful!
🛑 Stopping existing backend process...
🚀 Starting backend...
✅ Backend restarted!
📋 View logs with: tail -f /proc/$(pgrep -f '^\./parkopticon$')/fd/1
```

**Prerequisites:**
- Go installed
- Write permissions in backend directory
- No syntax errors in Go code

**Exit Codes:**
- `0` - Success
- `1` - Build failed

---

#### 3. `backend/setup-admin.sh`

**Purpose:** Creates the database and sets up the default admin user.

**Location:** `/backend/setup-admin.sh`

**Usage:**
```bash
./setup-admin.sh
```

**What it does:**
1. Creates `parkopticon` database (if not exists)
2. Enables PostGIS extension
3. Creates admin user with credentials:
   - Email: `admin@parkopticon.com`
   - Password: `admin123`
   - Username: `admin`
4. Sets admin privileges

**Output:**
```
Creating database and admin user...
✅ Database setup complete!

Admin credentials:
  Email: admin@parkopticon.com
  Password: admin123
```

**Prerequisites:**
- PostgreSQL installed and running
- `sudo` access to run `psql` as postgres user
- Database migrations already run

**Security Note:**
⚠️ The password `admin123` is hardcoded. Change it immediately in production using the admin portal.

---

#### 4. `backend/deploy.sh`

**Purpose:** Automated deployment script for production Ubuntu servers.

**Location:** `/backend/deploy.sh`

**Usage:**
```bash
./deploy.sh
```

**What it does:**
1. Pulls latest code from GitHub main branch
2. Stops running Docker containers
3. Removes old Docker images
4. Builds new Docker images with `--no-cache`
5. Starts containers with production environment
6. Waits for health checks
7. Displays status and cleans up

**Output:**
```
🚀 Starting Park-Opticon deployment...
📥 Pulling latest code from GitHub...
✅ Code updated successfully
🛑 Stopping existing containers...
🗑️  Removing old images...
🔨 Building new images...
▶️  Starting containers...
⏳ Waiting for services to be healthy...
🏥 Checking service health...
✅ Deployment successful!

📊 Container status:
[container list]

🌐 Backend is running at: http://[server-ip]:8080
```

**Environment Requirements:**
- Must be run from `/opt/parkopticon/Park-Opticon/backend`
- Requires `.env.prod` file with production secrets
- Docker and docker-compose installed
- Git repository configured with SSH keys

**Exit Codes:**
- `0` - Deployment successful
- `1` - Git pull failed, health check failed, or other error

**Configuration:**
```bash
PROJECT_DIR="/opt/parkopticon/Park-Opticon/backend"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
```

**Health Check:**
- Waits 10 seconds for services to start
- Checks Docker health status
- Shows logs if deployment fails

---

#### 5. `backend/scripts/init_db.sh`

**Purpose:** Complete database initialization script with interactive features.

**Location:** `/backend/scripts/init_db.sh`

**Usage:**
```bash
./init_db.sh
```

**Environment Variables:**
- `DB_HOST` - PostgreSQL host (default: `localhost`)
- `DB_PORT` - PostgreSQL port (default: `5432`)
- `DB_USER` - PostgreSQL user (default: `postgres`)
- `DB_PASSWORD` - PostgreSQL password (default: none)

**What it does:**
1. Validates PostgreSQL connection
2. Checks if database exists
3. Asks for confirmation if dropping existing database
4. Creates fresh `parkopticon` database
5. Runs all migration files in order:
   - `001_schema.sql` - Core schema
   - `002_parking_spots_polygon.sql` - Polygon support
   - `003_add_geofence.sql` - Geofencing
   - `004_parking_schedules_templates.sql` - Schedules
   - `005_fix_schedule_type_constraint.sql` - Constraints
6. Displays database summary

**Features:**
- Color-coded output (red/green/yellow)
- Interactive confirmation before dropping database
- Validates each migration step
- Shows table count and admin user count
- Comprehensive error handling

**Example Usage:**
```bash
# Use default settings
./init_db.sh

# Use custom host and credentials
DB_HOST=192.168.1.100 DB_USER=admin DB_PASSWORD=secret ./init_db.sh
```

**Output:**
```
🚀 Park Opticon Database Initialization
========================================

📋 Configuration:
  Host: localhost
  Port: 5432
  User: postgres
  Database: parkopticon

🔍 Checking PostgreSQL connection...
✅ PostgreSQL connection successful

🔍 Checking if database exists...
⚠️  Database 'parkopticon' already exists
   Do you want to DROP and recreate it? (yes/no): yes

🗑️  Dropping existing database...
✅ Database dropped

🏗️  Creating database 'parkopticon'...
✅ Database created

📦 Running migrations from: ../migrations

   📄 Applying 001_schema.sql...
   ✅ 001_schema.sql applied
   [... more migrations ...]

🎉 Database initialization complete!

📊 Database Summary:
   Tables created: 12
   Admin users: 1

🔑 Default Admin Credentials:
   Email: admin@parkopticon.com
   Password: admin123

⚠️  Remember to change the admin password in production!

✅ You can now start the backend server:
   cd backend && ./start.sh
```

**Prerequisites:**
- PostgreSQL with PostGIS installed
- `psql` command available
- Sufficient permissions to create databases

**Exit Codes:**
- `0` - Success
- `1` - Connection failed, migration failed, or user aborted

---

### PowerShell Scripts (Windows)

#### 6. `backend/start.ps1`

**Purpose:** Quick start script for Windows development.

**Location:** `/backend/start.ps1`

**Usage:**
```powershell
.\start.ps1
```

**What it does:**
1. Checks if Go is installed
2. Creates `.env` from `.env.example` if missing
3. Installs Go dependencies
4. Starts the backend server

**Features:**
- Color-coded output
- Automatic `.env` setup
- Dependency installation
- Comprehensive error checking

**Output:**
```
🚀 Park-Opticon Backend Quick Start

✅ Go installed: go version go1.21.0 windows/amd64

📦 Installing dependencies...
✅ Dependencies installed

🚀 Starting server...

[Server logs...]
```

**Prerequisites:**
- Go 1.21+ for Windows
- PowerShell 5.0+

**Exit Codes:**
- `0` - Success
- `1` - Go not installed or dependency installation failed

---

#### 7. `backend/start-docker.ps1`

**Purpose:** Starts the backend in Docker containers on Windows.

**Location:** `/backend/start-docker.ps1`

**Usage:**
```powershell
.\start-docker.ps1
```

**What it does:**
1. Checks if Docker Desktop is running
2. Starts containers using `docker-compose up -d`
3. Waits 10 seconds for initialization
4. Displays container status and access points
5. Shows useful commands

**Features:**
- Docker status validation
- Automatic IP detection (Wi-Fi/Ethernet)
- Comprehensive success messages
- Quick reference commands

**Output:**
```
🐳 Park-Opticon Backend - Docker Setup

✅ Docker is running

📦 Starting containers...

✅ Containers started successfully!

⏳ Waiting for services to initialize...

📊 Container Status:
[container list]

🌐 Access Points:

  Local:    http://localhost:8080
  Network:  http://192.168.1.100:8080

📋 Useful Commands:
  View logs:      docker-compose logs -f backend
  Stop:           docker-compose down
  Restart:        docker-compose restart

🧪 Test the API:
  curl http://localhost:8080/health

✨ Backend is ready! Check logs with:
  docker-compose logs -f backend
```

**Prerequisites:**
- Docker Desktop for Windows running
- PowerShell 5.0+

**Exit Codes:**
- `0` - Success
- `1` - Docker not running or container start failed

---

#### 8. `start-expo-android.ps1`

**Purpose:** Starts the Expo mobile app with Android emulator.

**Location:** `/start-expo-android.ps1` (root directory)

**Usage:**
```powershell
.\start-expo-android.ps1
```

**What it does:**
1. Sets Android SDK environment variables
2. Checks if emulator is running
3. Starts emulator if not running (Pixel_7_Pro_API_28)
4. Waits for emulator to boot (up to 2 minutes)
5. Starts Expo development server

**Environment Variables Set:**
```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
```

**Features:**
- Automatic emulator detection
- Emulator startup with boot waiting
- ADB device monitoring
- Timeout handling (120 seconds)

**Output:**
```
Checking emulator status...
Starting Android emulator...
Waiting for emulator to boot (this may take 1-2 minutes)...
Still waiting... (5 seconds)
Still waiting... (10 seconds)
Emulator is online!

Starting Expo...
[Expo logs...]
```

**Prerequisites:**
- Android Studio with SDK installed
- Android emulator configured (Pixel_7_Pro_API_28)
- Node.js and npm installed
- Expo CLI installed globally or in project

**Note:** Change AVD name in script if using different emulator:
```powershell
"-avd", "Pixel_7_Pro_API_28"  # Change this
```

---

### Python Scripts

#### 9. `backend/deploy-webhook.py`

**Purpose:** Webhook server for automatic GitHub deployment.

**Location:** `/backend/deploy-webhook.py`

**Usage:**
```bash
# Set webhook secret
export WEBHOOK_SECRET="your_secret_here"

# Run server
python3 deploy-webhook.py

# Or as systemd service (recommended)
sudo systemctl start parkopticon-webhook
```

**Configuration:**
```python
PORT = 9000
DEPLOY_SCRIPT = "/opt/parkopticon/deploy.sh"
SECRET = os.getenv("WEBHOOK_SECRET", "change_this_secret")
```

**What it does:**
1. Listens on port 9000 for POST requests to `/deploy`
2. Validates GitHub webhook signature (X-Hub-Signature-256)
3. Checks if push is to `main` branch
4. Executes deployment script if valid
5. Returns status and logs

**Features:**
- HMAC-SHA256 signature verification
- Branch filtering (only main branch)
- Timeout protection (300 seconds)
- Comprehensive logging
- Error handling and reporting

**Endpoints:**
- `POST /deploy` - Webhook endpoint

**GitHub Webhook Setup:**
1. Go to repository Settings → Webhooks
2. Add webhook URL: `http://your-server:9000/deploy`
3. Set content type: `application/json`
4. Set secret: Match `WEBHOOK_SECRET` environment variable
5. Select events: `push`

**Response Codes:**
- `200` - Deployment successful or skipped
- `401` - Invalid signature
- `404` - Invalid endpoint
- `500` - Deployment error

**Example Success Response:**
```
Deployment successful
✅ Deployment successful
[deployment script output]
```

**Example Error Response:**
```
Deployment failed
❌ Deployment failed: [error message]
```

**Systemd Service Setup:**
```bash
# Create service file
sudo nano /etc/systemd/system/parkopticon-webhook.service

[Unit]
Description=Park-Opticon Webhook Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/parkopticon
Environment="WEBHOOK_SECRET=your_secret_here"
ExecStart=/usr/bin/python3 /opt/parkopticon/deploy-webhook.py
Restart=always

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable parkopticon-webhook
sudo systemctl start parkopticon-webhook

# Check status
sudo systemctl status parkopticon-webhook
```

**Security Notes:**
- Always set a strong `WEBHOOK_SECRET`
- Run on internal network or use firewall rules
- Consider using HTTPS with reverse proxy
- Validate all input
- Log all deployment attempts

---

## Makefile Commands

**Location:** `/backend/Makefile`

**Usage:** `make <target>`

The Makefile provides convenient commands for Windows PowerShell (though it works on any platform with make installed).

### Available Targets

#### `make help`
Displays all available commands with descriptions.

**Usage:**
```bash
make help
```

---

#### `make install`
Downloads and tidies Go module dependencies.

**Usage:**
```bash
make install
```

**Commands executed:**
```bash
go mod download
go mod tidy
```

**When to use:**
- After cloning repository
- After modifying `go.mod`
- When dependencies are out of sync

---

#### `make run`
Runs the development server without building a binary.

**Usage:**
```bash
make run
```

**Command executed:**
```bash
go run cmd/server/main.go
```

**Features:**
- Fast startup (no build step)
- Hot reload with external tools (air)
- Development mode

---

#### `make build`
Builds production binary for Windows.

**Usage:**
```bash
make build
```

**Command executed:**
```bash
# Creates bin directory if needed
go build -o bin/server.exe cmd/server/main.go
```

**Output:**
- Creates `bin/server.exe`
- Ready for deployment

---

#### `make build-linux`
Cross-compiles binary for Linux deployment.

**Usage:**
```bash
make build-linux
```

**Command executed:**
```bash
$env:GOOS="linux"
$env:GOARCH="amd64"
go build -o bin/server cmd/server/main.go
```

**Output:**
- Creates `bin/server` (Linux binary)
- Ready for Ubuntu server deployment

**Environment:**
- `GOOS=linux`
- `GOARCH=amd64`

---

#### `make test`
Runs all tests with verbose output.

**Usage:**
```bash
make test
```

**Command executed:**
```bash
go test -v ./...
```

**Output:**
- Lists all tests
- Shows pass/fail status
- Displays test output

---

#### `make test-coverage`
Runs tests with coverage report and generates HTML.

**Usage:**
```bash
make test-coverage
```

**Commands executed:**
```bash
go test -cover ./...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

**Output:**
- Console coverage summary
- `coverage.out` - Coverage data
- `coverage.html` - Interactive HTML report

**View report:**
```bash
# Open in browser
start coverage.html  # Windows
open coverage.html   # macOS
xdg-open coverage.html  # Linux
```

---

#### `make clean`
Removes build artifacts and coverage files.

**Usage:**
```bash
make clean
```

**Removes:**
- `bin/` directory
- `coverage.out`
- `coverage.html`

---

#### `make docker-up`
Starts PostgreSQL with PostGIS in Docker.

**Usage:**
```bash
make docker-up
```

**Command executed:**
```bash
docker run --name parkopticon-db \
  -e POSTGRES_USER=parkopticon \
  -e POSTGRES_PASSWORD=parkopticon123 \
  -e POSTGRES_DB=parkopticon_db \
  -p 5432:5432 \
  -d postgis/postgis:latest
```

**Creates:**
- Container: `parkopticon-db`
- Database: `parkopticon_db`
- Port: `5432`
- Image: `postgis/postgis:latest`

**Credentials:**
- User: `parkopticon`
- Password: `parkopticon123`

---

#### `make docker-down`
Stops and removes PostgreSQL container.

**Usage:**
```bash
make docker-down
```

**Commands executed:**
```bash
docker stop parkopticon-db
docker rm parkopticon-db
```

**Warning:** This removes all data unless using volumes!

---

#### `make fmt`
Formats all Go code using `gofmt`.

**Usage:**
```bash
make fmt
```

**Command executed:**
```bash
go fmt ./...
```

**What it does:**
- Formats all `.go` files
- Applies Go standard formatting
- Saves files in place

---

#### `make lint`
Runs golangci-lint for code quality checks.

**Usage:**
```bash
make lint
```

**Command executed:**
```bash
golangci-lint run
```

**Prerequisites:**
```bash
make dev-tools  # Install linter first
```

**Checks:**
- Code style
- Best practices
- Potential bugs
- Performance issues
- Security vulnerabilities

---

#### `make dev-tools`
Installs development tools (air, golangci-lint).

**Usage:**
```bash
make dev-tools
```

**Commands executed:**
```bash
go install github.com/cosmtrek/air@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

**Tools installed:**
- `air` - Hot reload for Go
- `golangci-lint` - Comprehensive linter

---

#### `make dev`
Runs server with hot reload using air.

**Usage:**
```bash
make dev
```

**Prerequisites:**
```bash
make dev-tools  # Install air first
```

**Features:**
- Automatic recompilation on file changes
- Fast feedback loop
- Development optimization

**Configuration:**
Create `.air.toml` for custom settings or use defaults.

---

## Docker Commands

### Development Docker Compose

**File:** `backend/docker-compose.yml`

#### Start all services
```bash
docker-compose up -d
```

**Services started:**
- `postgres` - PostgreSQL with PostGIS
- `backend` - Go API server

**Ports:**
- `5432` - PostgreSQL
- `8080` - Backend API

---

#### View logs
```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Postgres only
docker-compose logs -f postgres

# Last 50 lines
docker-compose logs --tail=50 backend
```

---

#### Stop services
```bash
# Stop without removing
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop, remove containers, and volumes (deletes data!)
docker-compose down -v
```

---

#### Restart services
```bash
# Restart all
docker-compose restart

# Restart backend only
docker-compose restart backend
```

---

#### Rebuild and restart
```bash
# Rebuild without cache
docker-compose build --no-cache

# Rebuild and start
docker-compose up -d --build
```

---

#### Check status
```bash
# List containers
docker-compose ps

# Check health
docker-compose ps backend

# Inspect backend
docker inspect parkopticon-backend
```

---

#### Execute commands in containers
```bash
# Access backend shell
docker-compose exec backend sh

# Access postgres
docker-compose exec postgres psql -U parkopticon -d parkopticon_db

# Run migrations manually
docker-compose exec backend ./server migrate
```

---

### Production Docker Compose

**File:** `backend/docker-compose.prod.yml`

**Environment:** Uses `.env.prod` file

#### Start production
```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

#### Stop production
```bash
docker-compose -f docker-compose.prod.yml down
```

---

#### View production logs
```bash
docker-compose -f docker-compose.prod.yml logs -f backend
```

---

#### Check production health
```bash
docker inspect --format='{{.State.Health.Status}}' parkopticon-backend-prod
```

---

### Standalone Docker Commands

#### Build backend image
```bash
# From backend directory
docker build -t parkopticon/backend:latest .

# With no cache
docker build --no-cache -t parkopticon/backend:latest .

# With specific tag
docker build -t parkopticon/backend:v1.0.0 .
```

---

#### Run backend container manually
```bash
docker run -d \
  --name parkopticon-api \
  -p 8080:8080 \
  --env-file .env \
  parkopticon/backend:latest
```

---

#### Database container
```bash
# Start PostgreSQL
docker run -d \
  --name parkopticon-db \
  -e POSTGRES_USER=parkopticon \
  -e POSTGRES_PASSWORD=parkopticon123 \
  -e POSTGRES_DB=parkopticon_db \
  -p 5432:5432 \
  -v parkopticon_data:/var/lib/postgresql/data \
  postgis/postgis:15-3.3-alpine

# Stop
docker stop parkopticon-db

# Remove
docker rm parkopticon-db

# Remove with data
docker rm -v parkopticon-db
```

---

#### Useful Docker commands
```bash
# List all containers
docker ps -a

# List images
docker images

# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove all unused resources
docker system prune -a

# View container logs
docker logs -f parkopticon-backend

# Execute command in container
docker exec -it parkopticon-backend sh

# Copy files from container
docker cp parkopticon-backend:/root/logs ./logs

# Check resource usage
docker stats parkopticon-backend

# Inspect container
docker inspect parkopticon-backend

# View container processes
docker top parkopticon-backend
```

---

## NPM Scripts

### Admin Portal Scripts

**Location:** `admin-portal/package.json`

#### `npm run dev`
Starts Vite development server with network access.

**Usage:**
```bash
cd admin-portal
npm run dev
```

**Command:**
```bash
vite --host
```

**Features:**
- Hot module replacement (HMR)
- Accessible on local network
- Fast refresh
- Source maps

**Output:**
```
VITE v7.1.7  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
```

**Access from:**
- Local: http://localhost:5173
- Network: http://[your-ip]:5173
- Mobile: Same network, use network URL

---

#### `npm run build`
Builds production-optimized admin portal.

**Usage:**
```bash
cd admin-portal
npm run build
```

**Command:**
```bash
vite build
```

**Output:**
- Directory: `admin-portal/dist/`
- Optimized assets
- Minified code
- Tree-shaken bundles

**Features:**
- Code splitting
- Asset optimization
- Minification
- Source maps (optional)

**Deploy:**
```bash
# Serve locally
npm run preview

# Copy to web server
scp -r dist/* user@server:/var/www/parkopticon/
```

---

#### `npm run lint`
Runs ESLint on all source files.

**Usage:**
```bash
cd admin-portal
npm run lint
```

**Command:**
```bash
eslint .
```

**Checks:**
- React best practices
- JavaScript/JSX syntax
- Code style
- Potential bugs

**Fix automatically:**
```bash
eslint . --fix
```

---

#### `npm run preview`
Previews production build locally.

**Usage:**
```bash
cd admin-portal
npm run preview
```

**Command:**
```bash
vite preview
```

**Prerequisites:**
```bash
npm run build  # Build first
```

**Access:**
- Local: http://localhost:4173

---

### Mobile App (Expo) Scripts

**Location:** `parkopticon/package.json`

#### `npm start`
Starts Expo development server.

**Usage:**
```bash
cd parkopticon
npm start
```

**Command:**
```bash
expo start
```

**Features:**
- QR code for mobile testing
- Web interface at http://localhost:19000
- Metro bundler
- Fast refresh

**Options:**
- Press `a` - Open Android
- Press `i` - Open iOS
- Press `w` - Open web
- Press `r` - Reload app
- Press `m` - Toggle menu

---

#### `npm run android`
Starts app on Android emulator/device.

**Usage:**
```bash
cd parkopticon
npm run android
```

**Command:**
```bash
expo start --android
```

**Prerequisites:**
- Android Studio with SDK
- Emulator running OR device connected via USB
- ADB configured

**Troubleshooting:**
```bash
# List devices
adb devices

# Restart ADB
adb kill-server
adb start-server

# Reverse port
adb reverse tcp:8081 tcp:8081
```

---

#### `npm run ios`
Starts app on iOS simulator (macOS only).

**Usage:**
```bash
cd parkopticon
npm run ios
```

**Command:**
```bash
expo start --ios
```

**Prerequisites:**
- macOS
- Xcode installed
- iOS simulator configured

---

#### `npm run web`
Starts app in web browser.

**Usage:**
```bash
cd parkopticon
npm run web
```

**Command:**
```bash
expo start --web
```

**Access:**
- http://localhost:19006

**Note:** Some native features won't work on web.

---

## Database Scripts

### Direct PostgreSQL Commands

#### Connect to database
```bash
# As postgres user
sudo -u postgres psql

# As specific user
psql -U parkopticon -d parkopticon_db

# With password prompt
psql -U parkopticon -d parkopticon_db -W

# Remote connection
psql -h 192.168.1.100 -U parkopticon -d parkopticon_db
```

---

#### Common SQL commands
```sql
-- List databases
\l

-- Connect to database
\c parkopticon_db

-- List tables
\dt

-- Describe table
\d users

-- List users
\du

-- Show current user
\conninfo

-- Execute SQL file
\i /path/to/file.sql

-- Quit
\q
```

---

#### Database operations
```bash
# Create database
createdb -U postgres parkopticon_db

# Drop database
dropdb -U postgres parkopticon_db

# Backup database
pg_dump -U parkopticon parkopticon_db > backup.sql

# Restore database
psql -U parkopticon parkopticon_db < backup.sql

# Export specific table
pg_dump -U parkopticon -t users parkopticon_db > users_backup.sql
```

---

#### Run migrations manually
```bash
# From backend directory
for f in migrations/*.sql; do
    psql -U parkopticon -d parkopticon_db -f "$f"
done
```

---

#### Reset database
```bash
# Drop and recreate
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS parkopticon_db;
CREATE DATABASE parkopticon_db;
\c parkopticon_db
CREATE EXTENSION IF NOT EXISTS postgis;
EOF

# Run initialization script
./scripts/init_db.sh
```

---

#### Check database size
```sql
SELECT 
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'parkopticon_db';
```

---

#### Monitor active connections
```sql
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    backend_start,
    state
FROM pg_stat_activity
WHERE datname = 'parkopticon_db';
```

---

#### Kill specific connection
```sql
-- Get PID from pg_stat_activity
SELECT pg_terminate_backend(12345);
```

---

## Development Workflows

### Initial Setup Workflow

```bash
# 1. Clone repository
git clone https://github.com/your-org/Park-Opticon.git
cd Park-Opticon

# 2. Setup backend
cd backend

# 3. Install Go dependencies
make install
# OR
go mod download

# 4. Setup database (choose one method)

# Method A: Docker (recommended for development)
make docker-up
# OR
docker-compose up -d

# Method B: Local PostgreSQL
sudo systemctl start postgresql
./scripts/init_db.sh

# 5. Setup admin user
./setup-admin.sh

# 6. Configure environment
cp .env.example .env
nano .env  # Edit database credentials

# 7. Start backend
./start.sh full
# OR for mock mode
./start.sh mock

# 8. Setup admin portal
cd ../admin-portal
npm install
npm run dev

# 9. Setup mobile app
cd ../parkopticon
npm install
npm start
```

---

### Daily Development Workflow

```bash
# Start backend with database
cd backend
docker-compose up -d  # Or: ./start.sh full
make run  # Or: go run cmd/server/main.go

# In another terminal: Start admin portal
cd admin-portal
npm run dev

# In another terminal: Start mobile app
cd parkopticon
npm start
# Then press 'a' for Android or 'i' for iOS

# Make changes, test, repeat...

# Stop everything
# Ctrl+C in each terminal
docker-compose down  # Stop database
```

---

### Testing Workflow

```bash
# Backend tests
cd backend
make test

# With coverage
make test-coverage
open coverage.html  # View coverage report

# Specific package
go test ./internal/handlers -v

# Run specific test
go test ./internal/handlers -run TestLoginHandler -v

# Frontend linting
cd admin-portal
npm run lint

# Fix lint issues
npx eslint . --fix
```

---

### Hot Reload Development

```bash
# Backend hot reload
cd backend
make dev-tools  # Install air
make dev  # Start with hot reload

# Admin portal (already has HMR)
cd admin-portal
npm run dev

# Mobile app (already has fast refresh)
cd parkopticon
npm start
```

---

### Database Reset Workflow

```bash
# Full reset
cd backend
docker-compose down -v  # Stop and remove volumes
docker-compose up -d  # Restart
./scripts/init_db.sh  # Reinitialize
./setup-admin.sh  # Recreate admin user

# Or with local PostgreSQL
sudo -u postgres psql -c "DROP DATABASE parkopticon_db;"
./scripts/init_db.sh
./setup-admin.sh
```

---

## Deployment Workflows

### Manual Production Deployment

```bash
# On local machine
cd backend

# 1. Build Linux binary
make build-linux

# 2. Copy to server
scp bin/server user@your-server:/opt/parkopticon/

# 3. Copy updated files
scp -r migrations user@your-server:/opt/parkopticon/
scp .env.prod user@your-server:/opt/parkopticon/

# On server
ssh user@your-server
cd /opt/parkopticon

# 4. Stop existing server
pkill parkopticon

# 5. Run migrations
psql -U parkopticon -d parkopticon_db -f migrations/001_schema.sql
# ... etc for each migration

# 6. Start server
./server &

# 7. Check status
tail -f /var/log/parkopticon.log
```

---

### Docker Production Deployment

```bash
# On server
cd /opt/parkopticon/Park-Opticon/backend

# 1. Pull latest code
git pull origin main

# 2. Stop containers
docker-compose -f docker-compose.prod.yml down

# 3. Rebuild
docker-compose -f docker-compose.prod.yml build --no-cache

# 4. Start
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 5. Check health
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f backend

# Or use deploy script
./deploy.sh
```

---

### Automated Webhook Deployment

```bash
# On server - One-time setup

# 1. Clone repository
cd /opt/parkopticon
git clone https://github.com/your-org/Park-Opticon.git

# 2. Setup webhook secret
export WEBHOOK_SECRET="your_random_secret_here"

# 3. Create systemd service
sudo tee /etc/systemd/system/parkopticon-webhook.service > /dev/null <<EOF
[Unit]
Description=Park-Opticon Webhook Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/parkopticon/Park-Opticon/backend
Environment="WEBHOOK_SECRET=your_random_secret_here"
ExecStart=/usr/bin/python3 deploy-webhook.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 4. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable parkopticon-webhook
sudo systemctl start parkopticon-webhook

# 5. Check status
sudo systemctl status parkopticon-webhook

# 6. Setup GitHub webhook
# Go to repo → Settings → Webhooks → Add webhook
# URL: http://your-server-ip:9000/deploy
# Content type: application/json
# Secret: [same as WEBHOOK_SECRET]
# Events: Just the push event

# Now every push to main branch automatically deploys!
```

---

### Admin Portal Deployment

```bash
# Build for production
cd admin-portal
npm run build

# Deploy to web server
scp -r dist/* user@server:/var/www/parkopticon/

# Or use nginx
# Copy dist/* to /var/www/parkopticon
# Configure nginx:
server {
    listen 80;
    server_name admin.parkopticon.com;
    root /var/www/parkopticon;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Troubleshooting Commands

### Backend Issues

#### Check if server is running
```bash
# Check process
ps aux | grep parkopticon

# Check port
netstat -tulpn | grep 8080
# OR
lsof -i :8080

# Test health endpoint
curl http://localhost:8080/health
```

---

#### View logs
```bash
# If running with script
tail -f /proc/$(pgrep -f parkopticon)/fd/1

# If using systemd
journalctl -u parkopticon -f

# Docker logs
docker logs -f parkopticon-backend
```

---

#### Database connection issues
```bash
# Test PostgreSQL
psql -U parkopticon -d parkopticon_db -c "SELECT 1;"

# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

---

#### Port already in use
```bash
# Find what's using port 8080
sudo lsof -i :8080

# Kill process using port
kill $(lsof -t -i:8080)

# Or kill by PID
kill 12345
```

---

#### Go module issues
```bash
# Clean module cache
go clean -modcache

# Re-download dependencies
go mod download

# Tidy modules
go mod tidy

# Verify modules
go mod verify
```

---

### Docker Issues

#### Docker not running
```bash
# Linux
sudo systemctl start docker

# Check status
sudo systemctl status docker

# Windows/Mac
# Start Docker Desktop application
```

---

#### Container won't start
```bash
# Check logs
docker logs parkopticon-backend

# Check container status
docker ps -a

# Remove and recreate
docker-compose down
docker-compose up -d

# Remove volumes too
docker-compose down -v
docker-compose up -d
```

---

#### Network issues
```bash
# List networks
docker network ls

# Inspect network
docker network inspect parkopticon-network

# Recreate network
docker-compose down
docker network prune
docker-compose up -d
```

---

#### Clean Docker system
```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes

# WARNING: This removes ALL unused Docker resources!
```

---

### Database Issues

#### Can't connect to database
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL port
sudo netstat -tulpn | grep 5432

# Check PostgreSQL config
sudo nano /etc/postgresql/*/main/postgresql.conf

# Check if accepting connections
sudo grep listen_addresses /etc/postgresql/*/main/postgresql.conf

# Should be: listen_addresses = '*' or 'localhost'
```

---

#### Authentication failed
```bash
# Check pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Add line for local connections:
# local   all             all                                     trust
# host    all             all             127.0.0.1/32            md5

# Reload PostgreSQL
sudo systemctl reload postgresql
```

---

#### Reset database password
```bash
# Connect as postgres user
sudo -u postgres psql

# Reset password
ALTER USER parkopticon WITH PASSWORD 'new_password';

# Update .env file with new password
```

---

#### Migrations failed
```bash
# Check which migrations ran
psql -U parkopticon -d parkopticon_db

# List schema_migrations table
SELECT * FROM schema_migrations;

# Manually run failed migration
\i migrations/003_add_geofence.sql

# Or reset and rerun all
# CAUTION: This deletes all data!
./scripts/init_db.sh
```

---

### Frontend Issues

#### NPM install fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Try with legacy peer deps
npm install --legacy-peer-deps
```

---

#### Vite dev server won't start
```bash
# Check port availability
lsof -i :5173

# Kill process on port
kill $(lsof -t -i:5173)

# Try different port
vite --port 5174

# Clear Vite cache
rm -rf node_modules/.vite
```

---

#### Build fails
```bash
# Clear build cache
rm -rf dist
rm -rf node_modules/.vite

# Rebuild
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

---

### Mobile App Issues

#### Expo won't start
```bash
# Clear Expo cache
npx expo start -c

# Clear Metro cache
npx expo start --clear

# Reset Expo
rm -rf .expo node_modules
npm install
```

---

#### Android emulator issues
```bash
# List available emulators
emulator -list-avds

# Start emulator manually
emulator -avd Pixel_7_Pro_API_28

# Check ADB devices
adb devices

# Restart ADB
adb kill-server
adb start-server

# Reverse ports
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8080 tcp:8080
```

---

#### Build errors on Android
```bash
# Clean Gradle cache
cd android
./gradlew clean

# Rebuild
./gradlew assembleDebug

# Or from Expo
npx expo run:android
```

---

### Permission Issues

#### File permission denied
```bash
# Make script executable
chmod +x start.sh
chmod +x rebuild.sh
chmod +x scripts/init_db.sh

# Fix all shell scripts
find . -name "*.sh" -exec chmod +x {} \;
```

---

#### Docker permission denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again
# Or refresh group membership
newgrp docker

# Test
docker ps
```

---

#### PostgreSQL permission denied
```bash
# Check user permissions
sudo -u postgres psql -c "\du"

# Grant permissions
sudo -u postgres psql <<EOF
GRANT ALL PRIVILEGES ON DATABASE parkopticon_db TO parkopticon;
\c parkopticon_db
GRANT ALL ON SCHEMA public TO parkopticon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO parkopticon;
EOF
```

---

### Performance Issues

#### Backend slow response
```bash
# Check system resources
htop
# OR
top

# Check memory usage
free -h

# Check disk space
df -h

# Check database performance
psql -U parkopticon -d parkopticon_db

# Slow queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
```

---

#### Database slow queries
```sql
-- Enable query logging
ALTER DATABASE parkopticon_db SET log_min_duration_statement = 1000;

-- View slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM parking_spots WHERE geofence_id IS NOT NULL;

-- Create indexes
CREATE INDEX idx_parking_spots_geofence ON parking_spots(geofence_id);
CREATE INDEX idx_parking_spots_location ON parking_spots USING GIST(location);
```

---

#### Docker container consuming resources
```bash
# Check resource usage
docker stats

# Limit resources
docker run -d \
  --cpus="1.0" \
  --memory="512m" \
  parkopticon/backend:latest

# Or in docker-compose.yml:
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
```

---

## Quick Reference

### Most Common Commands

```bash
# Start development environment
cd backend && docker-compose up -d && make run
cd admin-portal && npm run dev
cd parkopticon && npm start

# Run tests
cd backend && make test

# Deploy production
ssh user@server
cd /opt/parkopticon/Park-Opticon/backend
./deploy.sh

# View logs
docker-compose logs -f backend
journalctl -u parkopticon -f

# Reset database
./scripts/init_db.sh
./setup-admin.sh

# Build production
make build-linux  # Backend
npm run build  # Admin portal
```

---

### Important Ports

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 8080 | Main Go server |
| PostgreSQL | 5432 | Database |
| Admin Portal (dev) | 5173 | Vite dev server |
| Admin Portal (preview) | 4173 | Production preview |
| Expo Dev Server | 19000 | Metro bundler |
| Expo Web | 19006 | Web version |
| Webhook Server | 9000 | GitHub webhooks |

---

### Default Credentials

| Service | Username | Email | Password |
|---------|----------|-------|----------|
| Admin User | admin | admin@parkopticon.com | admin123 |
| PostgreSQL (dev) | parkopticon | - | parkopticon123 |
| PostgreSQL (local) | parkopticon | - | parkopticon_dev_password |

⚠️ **Change all default passwords in production!**

---

### Environment Variables

#### Backend (.env)
```bash
# Server
PORT=8080
ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=parkopticon
DB_PASSWORD=parkopticon123
DB_NAME=parkopticon_db
DB_SSLMODE=disable

# JWT
JWT_SECRET=your_secret_here
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=168h

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=parkopticon-photos

# Workers
ALERT_CHECK_INTERVAL=30s
SPOT_EXPIRY_CHECK_INTERVAL=5m

# CORS
CORS_ALLOWED_ORIGINS=*
CORS_ALLOW_CREDENTIALS=true

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
```

---

## Appendix

### System Requirements

**Development:**
- OS: Linux, macOS, or Windows 10/11
- Go 1.21+
- Node.js 18+
- PostgreSQL 14+ with PostGIS
- Docker Desktop (optional)
- 8GB RAM minimum
- 20GB free disk space

**Production:**
- Ubuntu 20.04 or 22.04 LTS
- Go 1.21+
- PostgreSQL 14+ with PostGIS
- Docker and docker-compose
- 4GB RAM minimum
- 50GB free disk space
- Nginx (for admin portal)

---

### File Locations

**Backend:**
- Binary: `backend/bin/server` or `backend/parkopticon`
- Migrations: `backend/migrations/*.sql`
- Config: `backend/.env`
- Logs: `backend/logs/` or stdout

**Admin Portal:**
- Build: `admin-portal/dist/`
- Config: `admin-portal/vite.config.js`

**Mobile App:**
- Config: `parkopticon/app.json`
- Cache: `parkopticon/.expo/`

---

### Support & Resources

**Documentation:**
- Backend Architecture: `backend/ARCHITECTURE.md`
- API Testing: `backend/API_TESTING.md`
- Database Schema: `DATABASE_SCHEMA.md`
- Admin Portal Guide: `admin-portal/QUICK_START.md`

**Common Issues:**
- Docker Setup: `backend/DOCKER_SETUP_COMPLETE.md`
- Mock Mode: `backend/MOCK_MODE_GUIDE.md`
- Quick Start: `START_HERE.md`

---

## Changelog

**v1.0 (2025-11-12)**
- Initial comprehensive documentation
- Documented all shell scripts
- Documented all PowerShell scripts
- Documented Makefile targets
- Documented Docker commands
- Documented NPM scripts
- Added troubleshooting section
- Added deployment workflows

---

**End of Documentation**

For questions or issues, refer to individual script files for inline comments or check the main project documentation in the `docs/` directory.
