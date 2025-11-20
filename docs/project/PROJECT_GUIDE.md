# Park-Opticon Project Guide

## Overview

Park-Opticon is a comprehensive parking management system with three main components:
- **Backend API** (Go + PostgreSQL + PostGIS)
- **Admin Portal** (React + Vite)
- **Mobile App** (React Native + Expo)

## Project Structure

```
Park-Opticon/
├── admin-portal/     # React admin dashboard
├── backend/          # Go API server
├── parkopticon/      # React Native mobile app
├── docs/            # Documentation
└── scripts/         # Various utility scripts
```

## Quick Start

### Prerequisites

- **Go 1.21+** (for backend)
- **Node.js 18+** (for frontend/mobile)
- **PostgreSQL 13+** with PostGIS (for database)
- **Docker** (optional, for containerized deployment)

### 1. Database Setup

First, set up PostgreSQL and create the database:

```bash
# Install PostgreSQL and PostGIS (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib postgis postgresql-13-postgis-3

# Create database user
sudo -u postgres createuser --createdb --login parkopticon
sudo -u postgres psql -c "ALTER USER parkopticon PASSWORD 'your_password';"

# Initialize database
cd backend
./scripts/init_db.sh
```

### 2. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# Quick start (Linux/Mac)
./start.sh full

# Or for Windows PowerShell
.\start.ps1

# Or using Docker
.\start-docker.ps1
```

### 3. Admin Portal Setup

```bash
cd admin-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Mobile App Setup

```bash
cd parkopticon

# Install dependencies
npm install

# Start Expo development server
npx expo start

# For Android emulator (Windows)
# Run from project root:
.\start-expo-android.ps1
```

## Available Scripts

### Backend Scripts

#### `rebuild.sh` - Rebuild and Restart Backend
**Location:** `backend/rebuild.sh`

Quick rebuild script for development. Builds the Go binary, stops any existing process, and starts the new one.

```bash
cd backend
./rebuild.sh
```

#### `start.sh` - Backend Startup Script
**Location:** `backend/start.sh`

Main startup script with mode selection.

```bash
cd backend

# Full mode (with database)
./start.sh full

# Mock mode (no database, test data)
./start.sh mock
```

#### `start.ps1` - Windows PowerShell Startup
**Location:** `backend/start.ps1`

Windows equivalent of the startup script. Checks for Go installation and environment setup.

```powershell
cd backend
.\start.ps1
```

#### `start-docker.ps1` - Docker Startup
**Location:** `backend/start-docker.ps1`

Starts the backend using Docker Compose. Includes health checks and status display.

```powershell
cd backend
.\start-docker.ps1
```

#### `setup-admin.sh` - Database Admin Setup
**Location:** `backend/setup-admin.sh`

Creates the default admin user in the database.

```bash
cd backend
./setup-admin.sh
```

**Default Admin Credentials:**
- Email: `admin@parkopticon.com`
- Password: `admin123`

#### `deploy.sh` - Production Deployment
**Location:** `backend/deploy.sh`

Production deployment script for Ubuntu servers. Pulls code, rebuilds containers, and deploys.

```bash
# On production server
/opt/parkopticon/deploy.sh
```

#### `scripts/init_db.sh` - Database Initialization
**Location:** `backend/scripts/init_db.sh`

Complete database setup script. Creates database, runs migrations, and sets up initial data.

```bash
cd backend
./scripts/init_db.sh
```

### Mobile App Scripts

#### `start-expo-android.ps1` - Android Emulator Setup
**Location:** `start-expo-android.ps1`

Windows script that starts Android emulator and Expo development server.

```powershell
# From project root
.\start-expo-android.ps1
```

## Development Workflow

### Backend Development

1. **Make changes** to Go code
2. **Rebuild and restart:**
   ```bash
   cd backend && ./rebuild.sh
   ```
3. **Check logs** for any errors

### Frontend Development

1. **Make changes** to React components
2. **Hot reload** is automatic with `npm run dev`
3. **Check browser console** for errors

### Mobile Development

1. **Make changes** to React Native code
2. **Expo hot reload** is automatic
3. **Test on device/emulator**

## Environment Configuration

### Backend (.env)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=parkopticon
DB_PASSWORD=your_password
DB_NAME=parkopticon_db

# JWT
JWT_SECRET=your_jwt_secret

# Server
PORT=8080
ENV=development

# AWS (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

### Admin Portal

The admin portal connects to the backend API. Configure the API URL in `admin-portal/src/api/client.js`:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Admin login
- `GET /api/v1/profile` - Get current user profile

### Admin Endpoints
- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/parking-spots` - List all parking spots
- `POST /api/v1/admin/parking-spots` - Create parking spot
- `PUT /api/v1/admin/parking-spots/:id` - Update parking spot
- `DELETE /api/v1/admin/parking-spots/:id` - Delete parking spot

### Public Endpoints
- `POST /api/v1/parking-spots` - Report parking spot
- `GET /api/v1/parking-spots/nearby` - Find nearby spots
- `POST /api/v1/enforcement-alerts` - Report enforcement

## Database Schema

The system uses PostgreSQL with PostGIS for geospatial data. Key tables:

- `users` - User accounts
- `parking_spots` - Available parking locations
- `parking_spaces` - Individual parking spaces
- `enforcement_alerts` - Parking enforcement reports
- `parking_sessions` - Active parking sessions
- `tickets` - Parking tickets/citations

## Deployment

### Docker Deployment

```bash
cd backend
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

1. Set up Ubuntu server with PostgreSQL
2. Clone repository
3. Run `./backend/deploy.sh`
4. Configure reverse proxy (nginx)
5. Set up SSL certificates

## Troubleshooting

### Backend Issues

**Database connection failed:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database exists
psql -U parkopticon -d parkopticon_db -c "SELECT 1;"
```

**Build failed:**
```bash
cd backend
go mod tidy
go build cmd/server/main.go
```

### Frontend Issues

**Dependencies:**
```bash
cd admin-portal
rm -rf node_modules package-lock.json
npm install
```

**CORS errors:**
- Ensure backend is running on correct port
- Check CORS configuration in backend

### Mobile Issues

**Expo issues:**
```bash
cd parkopticon
npx expo install --fix
```

**Android emulator:**
- Ensure Android SDK is installed
- Check emulator configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## Support

- Check the `docs/` directory for detailed documentation
- Review `README.md` files in each component directory
- Check existing issues on GitHub

## License

This project is licensed under the MIT License.