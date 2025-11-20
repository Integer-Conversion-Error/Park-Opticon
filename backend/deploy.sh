#!/bin/bash
# Deployment script for Park-Opticon backend
# Place this on your Ubuntu server at /opt/parkopticon/deploy.sh

set -e  # Exit on error

echo "🚀 Starting Park-Opticon deployment..."

# Configuration
PROJECT_DIR="/opt/parkopticon/Park-Opticon/backend"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

# Navigate to project directory
cd "$PROJECT_DIR"

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Check if there are changes
if [ $? -eq 0 ]; then
    echo "✅ Code updated successfully"
else
    echo "❌ Failed to pull code"
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f "$COMPOSE_FILE" down

# Remove old images
echo "🗑️  Removing old images..."
docker image prune -f

# Build new images
echo "🔨 Building new images..."
docker-compose -f "$COMPOSE_FILE" build --no-cache

# Start containers
echo "▶️  Starting containers..."
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo "🏥 Checking service health..."
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' parkopticon-backend-prod 2>/dev/null || echo "unknown")

if [ "$HEALTH" == "healthy" ] || [ "$HEALTH" == "unknown" ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📊 Container status:"
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "🌐 Backend is running at: http://$(hostname -I | awk '{print $1}'):8080"
else
    echo "❌ Deployment failed - service unhealthy"
    echo ""
    echo "📋 Logs:"
    docker-compose -f "$COMPOSE_FILE" logs --tail=50 backend
    exit 1
fi

# Cleanup
echo "🧹 Cleaning up..."
docker system prune -f

echo ""
echo "✨ Deployment complete!"
date
