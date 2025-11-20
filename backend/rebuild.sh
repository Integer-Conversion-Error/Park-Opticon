#!/bin/bash

# Rebuild and restart the Park-Opticon backend

echo "🔨 Rebuilding backend..."
cd /root/Projects/Park-Opticon/backend

# Build the binary
go build -o parkopticon cmd/server/main.go

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Kill existing process (but not ssh/sshd)
echo "🛑 Stopping existing backend process..."
pkill -f "^\./parkopticon$" 2>/dev/null || true

# Wait a moment for the process to stop
sleep 1

# Start the new process
echo "🚀 Starting backend..."
./parkopticon &

echo "✅ Backend restarted!"
echo "📋 View logs with: tail -f /proc/\$(pgrep -f '^\./parkopticon$')/fd/1"
