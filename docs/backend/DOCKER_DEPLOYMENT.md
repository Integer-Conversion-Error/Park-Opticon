# 🐳 Docker Deployment Guide

**Run Park-Opticon backend in Docker - locally now, Ubuntu server later**

---

## 🎯 Overview

This setup gives you:
- ✅ Backend + PostgreSQL in Docker containers
- ✅ Run locally on Windows (Docker Desktop)
- ✅ Easy transfer to Ubuntu server later
- ✅ Accessible from any device on your network
- ✅ Auto-restart on failures
- ✅ Persistent data storage

---

## 📋 Prerequisites

### On Your Laptop (Windows)

1. **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
   - Install and start Docker Desktop
   - Enable WSL 2 if prompted

2. **Git** - Already have it ✅

### On Ubuntu Server (For Later)

1. **Docker** and **Docker Compose**
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose
   sudo systemctl enable docker
   sudo systemctl start docker
   sudo usermod -aG docker $USER
   ```

---

## 🚀 Part 1: Run Locally on Windows

### Step 1: Build and Start Containers

```powershell
cd backend

# Build and start everything
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

You should see:
```
✅ Database connected successfully
✅ Database migrations completed
✅ Background alert checker started
🚀 Server starting on :8080
```

### Step 2: Test the API

```powershell
# Health check
curl http://localhost:8080/health

# Register a user
curl -X POST http://localhost:8080/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "username": "testuser"
  }'
```

### Step 3: Access from Your Desktop (Same Network)

Find your laptop's local IP:
```powershell
# Get your local IP
ipconfig | Select-String "IPv4"
```

Example: `192.168.1.100`

**On your desktop, access:**
```
http://192.168.1.100:8080
```

---

## 🏠 Part 2: Expose on Your Home Network

### Option A: Local Network Only (Easiest)

Your backend is already accessible via `http://<laptop-ip>:8080` from any device on your WiFi.

**Configure React Native app:**
```javascript
// For testing on physical device
const API_BASE_URL = 'http://192.168.1.100:8080/api/v1';
```

### Option B: Port Forwarding (Router Setup)

**On your router:**
1. Log into router admin (usually `192.168.1.1`)
2. Find "Port Forwarding" or "Virtual Server"
3. Forward port `8080` → Your laptop's local IP
4. Now accessible via your public IP: `http://<your-public-ip>:8080`

⚠️ **Security Warning**: This exposes your backend to the internet. Only use for testing!

### Option C: Tailscale (Recommended for Remote Access)

**Best option for secure remote access between your devices:**

1. Install Tailscale on all devices: [tailscale.com](https://tailscale.com)
   ```powershell
   # Windows: Download installer
   
   # Ubuntu: 
   curl -fsSL https://tailscale.com/install.sh | sh
   ```

2. Start Tailscale and login on all devices

3. Access via Tailscale IP (e.g., `http://100.x.x.x:8080`)

**Benefits:**
- ✅ Secure VPN connection
- ✅ Access from anywhere (coffee shop, work, etc.)
- ✅ No router configuration needed
- ✅ Free for personal use

---

## 🖥️ Part 3: Move to Ubuntu Server

### Preparation (When You Can Access Ubuntu)

**1. On your Ubuntu server:**

```bash
# Install Docker
sudo apt update
sudo apt install docker.io docker-compose git

# Enable Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Create project directory
sudo mkdir -p /opt/parkopticon
sudo chown $USER:$USER /opt/parkopticon
cd /opt/parkopticon
```

**2. Transfer files to Ubuntu:**

**Option A: Git (Recommended)**
```bash
# On Ubuntu server
cd /opt/parkopticon
git clone https://github.com/solace-esadnkaya/Park-Opticon.git
cd Park-Opticon/backend
```

**Option B: SCP from Windows**
```powershell
# From your laptop
scp -r backend ubuntu-user@<ubuntu-ip>:/opt/parkopticon/
```

**Option C: Export/Import Docker Image**
```powershell
# On Windows - Export image
docker save parkopticon/backend:latest -o parkopticon-backend.tar

# Transfer to USB drive or network

# On Ubuntu - Import image
docker load -i parkopticon-backend.tar
```

### Running on Ubuntu

**1. Create production .env file:**
```bash
cd /opt/parkopticon/Park-Opticon/backend

cat > .env.prod << 'EOF'
# Production Environment Variables
DB_PASSWORD=generate_secure_password_here
JWT_SECRET=generate_long_random_secret_here

# AWS (if using S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=parkopticon-photos

# CORS - Add your frontend URLs
CORS_ALLOWED_ORIGINS=http://localhost:19006,http://your-laptop-ip:19006
EOF
```

**2. Start production containers:**
```bash
# Using production compose file
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

**3. Set up auto-start on boot:**
```bash
# Create systemd service
sudo nano /etc/systemd/system/parkopticon.service
```

Add:
```ini
[Unit]
Description=Park-Opticon Backend
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/parkopticon/Park-Opticon/backend
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
User=your-username

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable parkopticon
sudo systemctl start parkopticon
```

---

## 🔄 Part 4: Auto-Deploy from Git Pushes

### Option A: GitHub Actions + SSH (Simple)

**1. Set up SSH key on Ubuntu:**
```bash
# On Ubuntu server
ssh-keygen -t ed25519 -C "parkopticon-deploy"
cat ~/.ssh/id_ed25519.pub  # Add to GitHub deploy keys
```

**2. Create deploy script on Ubuntu:**
```bash
nano /opt/parkopticon/deploy.sh
```

```bash
#!/bin/bash
cd /opt/parkopticon/Park-Opticon/backend

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

echo "Deployment complete!"
```

Make executable:
```bash
chmod +x /opt/parkopticon/deploy.sh
```

**3. Create webhook endpoint (simple Python server):**

See the separate file `deploy-webhook.py` I'll create next.

### Option B: Watchtower (Auto-update Docker images)

```bash
# Add to docker-compose.prod.yml
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300 \
  parkopticon-backend-prod
```

Watchtower will automatically pull and restart updated images.

---

## 🔧 Useful Commands

### Docker Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Access container shell
docker exec -it parkopticon-backend sh

# Access database
docker exec -it parkopticon-db psql -U parkopticon -d parkopticon_db

# Remove everything (including data)
docker-compose down -v
```

### Maintenance

```bash
# Backup database
docker exec parkopticon-db pg_dump -U parkopticon parkopticon_db > backup.sql

# Restore database
docker exec -i parkopticon-db psql -U parkopticon -d parkopticon_db < backup.sql

# Clean up old images
docker system prune -a

# Check container resource usage
docker stats
```

---

## 🌐 Network Configuration

### Find Your Server's IP

**On Ubuntu:**
```bash
# Local network IP
hostname -I

# Or
ip addr show | grep "inet "
```

**Configure firewall (Ubuntu):**
```bash
# Allow port 8080
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable
```

### Access Points

**Local network:**
```
http://<ubuntu-ip>:8080
```

**With Tailscale:**
```
http://<tailscale-ip>:8080
```

**React Native app config:**
```javascript
// For development (same network)
const API_BASE_URL = 'http://192.168.1.50:8080/api/v1';

// For Tailscale
const API_BASE_URL = 'http://100.x.x.x:8080/api/v1';
```

---

## 🚨 Troubleshooting

### Backend won't start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Database not ready - wait a few seconds and restart
# 2. Port 8080 already in use - change in docker-compose.yml
```

### Can't connect from other devices

```bash
# Check if containers are running
docker-compose ps

# Check firewall (Ubuntu)
sudo ufw status

# Test locally first
curl http://localhost:8080/health

# Then test with IP
curl http://<server-ip>:8080/health
```

### Database connection issues

```bash
# Check if PostgreSQL is ready
docker exec parkopticon-db pg_isready -U parkopticon

# View database logs
docker-compose logs postgres

# Verify PostGIS extension
docker exec -it parkopticon-db psql -U parkopticon -d parkopticon_db -c "SELECT PostGIS_Version();"
```

---

## 📊 Monitoring

### View Logs

```bash
# All logs
docker-compose logs -f

# Just backend
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Health Checks

```bash
# Check backend health
curl http://localhost:8080/health

# Check container health
docker inspect parkopticon-backend | grep -A 10 Health
```

---

## 🔐 Security Recommendations

### For Production

1. **Change default passwords** in `.env.prod`
2. **Use HTTPS** - Add nginx reverse proxy with Let's Encrypt
3. **Restrict CORS** - Set specific origins in CORS_ALLOWED_ORIGINS
4. **Enable firewall** - Only expose necessary ports
5. **Regular backups** - Automate database backups
6. **Update regularly** - Keep Docker images updated

### HTTPS with nginx (Optional)

```nginx
# /etc/nginx/sites-available/parkopticon
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🎉 Summary

**Current Setup (Windows Laptop):**
```
Your Laptop (Windows)
  └── Docker Desktop
      ├── parkopticon-backend (Go API)
      └── parkopticon-db (PostgreSQL + PostGIS)

Access: http://localhost:8080
Network: http://192.168.1.x:8080
```

**Future Setup (Ubuntu Server):**
```
Ubuntu Server (Always On)
  └── Docker
      ├── parkopticon-backend (Go API)
      └── parkopticon-db (PostgreSQL + PostGIS)

Access: http://<ubuntu-ip>:8080
Tailscale: http://100.x.x.x:8080
```

**Development Workflow:**
1. Code on laptop or desktop
2. Push to GitHub
3. Ubuntu server auto-deploys (webhook)
4. Access from anywhere via Tailscale

---

**Ready to deploy! 🚀**
