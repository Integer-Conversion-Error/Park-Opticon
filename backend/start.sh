#!/bin/bash

# Park-Opticon Backend Startup Script
# Usage: ./start.sh [mock|full]

set -e

# Add Go to PATH
export PATH=$PATH:/usr/local/go/bin

# Get mode from argument
MODE=${1:-full}

cd "$(dirname "$0")"

echo "🚀 Park-Opticon Backend Startup"
echo "================================"
echo ""

if [ "$MODE" = "mock" ]; then
    echo "🧪 Starting in MOCK MODE"
    echo ""
    echo "Features:"
    echo "  - No database required"
    echo "  - Immutable test data"
    echo "  - Perfect for frontend development"
    echo ""
    go run cmd/server/main.go --mock
elif [ "$MODE" = "full" ]; then
    echo "🚀 Starting in FULL MODE"
    echo ""
    echo "Features:"
    echo "  - Full database persistence"
    echo "  - Run ./start-worker.sh or 'go run cmd/worker/main.go' separately for alert delivery"
    echo "  - Production-ready"
    echo ""
    
    # Check if PostgreSQL is running
    if ! sudo systemctl is-active --quiet postgresql; then
        echo "⚠️  PostgreSQL is not running. Starting it..."
        sudo systemctl start postgresql
        sleep 2
    fi
    
    echo "✅ PostgreSQL is running"
    echo ""
    
    go run cmd/server/main.go
else
    echo "❌ Invalid mode: $MODE"
    echo ""
    echo "Usage: ./start.sh [mock|full]"
    echo ""
    echo "Modes:"
    echo "  mock  - Run with test data (no database)"
    echo "  full  - Run with PostgreSQL database"
    echo ""
    exit 1
fi
