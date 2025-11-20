# Park-Opticon Backend - Docker Quick Start
# Run this script to start the backend in Docker

Write-Host "🐳 Park-Opticon Backend - Docker Setup" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
$dockerRunning = docker info 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    Write-Host "Download: https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Navigate to backend directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "📦 Starting containers..." -ForegroundColor Cyan
Write-Host ""

# Start containers
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Containers started successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Wait a few seconds
    Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Check status
    Write-Host ""
    Write-Host "📊 Container Status:" -ForegroundColor Cyan
    docker-compose ps
    
    Write-Host ""
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Local:    http://localhost:8080" -ForegroundColor White
    
    # Try to get local IP
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*","Ethernet*" | 
                Select-Object -First 1).IPAddress
    
    if ($localIP) {
        Write-Host "  Network:  http://${localIP}:8080" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "📋 Useful Commands:" -ForegroundColor Cyan
    Write-Host "  View logs:      docker-compose logs -f backend" -ForegroundColor White
    Write-Host "  Stop:           docker-compose down" -ForegroundColor White
    Write-Host "  Restart:        docker-compose restart" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🧪 Test the API:" -ForegroundColor Cyan
    Write-Host "  curl http://localhost:8080/health" -ForegroundColor White
    Write-Host ""
    
    Write-Host "✨ Backend is ready! Check logs with:" -ForegroundColor Green
    Write-Host "  docker-compose logs -f backend" -ForegroundColor Cyan
    
} else {
    Write-Host ""
    Write-Host "❌ Failed to start containers" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check the error messages above or try:" -ForegroundColor Yellow
    Write-Host "  docker-compose logs" -ForegroundColor White
}

Write-Host ""
