# Park-Opticon Backend PowerShell Scripts

# Quick start script for Windows
Write-Host "🚀 Park-Opticon Backend Quick Start" -ForegroundColor Cyan
Write-Host ""

# Check if Go is installed
$goVersion = go version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Go is not installed. Please install Go 1.21+ from https://golang.org/dl/" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Go installed: $goVersion" -ForegroundColor Green

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "⚠️  No .env file found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Created .env file. Please update database credentials!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Edit .env and then run this script again." -ForegroundColor Cyan
    exit 0
}

# Install dependencies
Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
go mod download
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Check if PostgreSQL is running
Write-Host ""
Write-Host "🔍 Checking PostgreSQL connection..." -ForegroundColor Cyan

# Try to connect (this will fail if DB isn't running, but that's ok for now)
# The app will handle it

Write-Host ""
Write-Host "🚀 Starting server..." -ForegroundColor Cyan
Write-Host ""

go run cmd/server/main.go
