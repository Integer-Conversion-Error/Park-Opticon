# 🚀 Quick Start Guide - Docker Development Server

**Get your backend running in 5 minutes!**

---

## Step 1: Install Docker Desktop (If Not Already)

**Windows:** [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)

After installation, start Docker Desktop.

---

## Step 2: Start the Backend

Open PowerShell in the backend directory:

```powershell
cd backend

# Start everything (backend + database)
docker-compose up -d

# View logs
docker-compose logs -f backend
```

Wait for:
```
✅ Database connected successfully
✅ Database migrations completed
🚀 Server starting on :8080
```

---

## Step 3: Test It Works

```powershell
# Health check
curl http://localhost:8080/health

# Should return: {"status":"healthy"}
```

---

## Step 4: Find Your Local IP

```powershell
ipconfig | Select-String "IPv4"
```

Example output: `192.168.1.100`

---

## Step 5: Access from Other Devices

**From your desktop or phone (on same WiFi):**
```
http://192.168.1.100:8080
```

**Update React Native app:**
```javascript
// parkopticon/src/services/api.js
const API_BASE_URL = 'http://192.168.1.100:8080/api/v1';
```

---

## 🎯 That's It!

Your backend is now:
- ✅ Running in Docker
- ✅ Accessible from your network
- ✅ Auto-restarts on failure
- ✅ Data persists in Docker volumes

---

## 📱 Next Steps

### Test with React Native App

```powershell
# In parkopticon directory
cd ..\parkopticon

# Update the API URL in your code
# Then start Expo
npx expo start
```

### Stop the Backend

```powershell
docker-compose down
```

### Restart the Backend

```powershell
docker-compose up -d
```

### View Logs

```powershell
docker-compose logs -f backend
```

---

## 🏠 Move to Ubuntu Server Later

When you have access to your Ubuntu PC:

1. **Copy the entire backend folder** to Ubuntu
2. **Run:** `docker-compose -f docker-compose.prod.yml up -d`
3. **Access from anywhere** using Tailscale (see DOCKER_DEPLOYMENT.md)

---

## 🆘 Troubleshooting

**Can't connect?**
- Check Docker Desktop is running
- Check Windows Firewall isn't blocking port 8080
- Try: `docker-compose restart`

**Database errors?**
- Wait 10 seconds for PostgreSQL to start
- Check logs: `docker-compose logs postgres`

**Need to reset everything?**
```powershell
docker-compose down -v  # Removes data!
docker-compose up -d
```

---

## 🔗 Useful Links

- Full deployment guide: `DOCKER_DEPLOYMENT.md`
- API testing: `API_TESTING.md`
- Backend docs: `README.md`

---

**Questions? Check the docs or ask! 🚀**
