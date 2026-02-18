#!/bin/bash

# Start all servers for Trip Tracker
# This script runs all three servers in the background

cd "$(dirname "$0")"

# Kill any existing servers
echo "Stopping any existing servers..."
pkill -f "nx serve api" || true
pkill -f "nx serve frontend-app" || true
pkill -f "nx serve frontend-admin" || true
sleep 2

# Create log directory
mkdir -p logs

# Start API server
echo "Starting API server on port 3001..."
nohup npx nx serve api > logs/api.log 2>&1 &
API_PID=$!
echo "API server PID: $API_PID"

sleep 3

# Start frontend-app
echo "Starting frontend-app on port 4200..."
nohup npx nx serve frontend-app > logs/frontend-app.log 2>&1 &
APP_PID=$!
echo "Frontend-app PID: $APP_PID"

sleep 3

# Start frontend-admin
echo "Starting frontend-admin on port 4201..."
nohup npx nx serve frontend-admin > logs/frontend-admin.log 2>&1 &
ADMIN_PID=$!
echo "Frontend-admin PID: $ADMIN_PID"

echo ""
echo "All servers started!"
echo ""
echo "API:            http://localhost:3001 (PID: $API_PID)"
echo "Frontend App:   http://localhost:4200 (PID: $APP_PID)"
echo "Frontend Admin: http://localhost:4201 (PID: $ADMIN_PID)"
echo ""
echo "Logs are in the 'logs' directory"
echo "To stop servers, run: ./stop-servers.sh"
echo ""

# Wait a bit and check if servers are still running
sleep 5
echo "Checking server status..."
if lsof -i :3001 > /dev/null 2>&1; then
    echo "✓ API server is responding on port 3001"
else
    echo "✗ API server is NOT responding on port 3001"
    echo "  Check logs/api.log for errors"
fi

if lsof -i :4200 > /dev/null 2>&1; then
    echo "✓ Frontend-app is responding on port 4200"
else
    echo "✗ Frontend-app is NOT responding on port 4200"
    echo "  Check logs/frontend-app.log for errors"
fi

if lsof -i :4201 > /dev/null 2>&1; then
    echo "✓ Frontend-admin is responding on port 4201"
else
    echo "✗ Frontend-admin is NOT responding on port 4201"
    echo "  Check logs/frontend-admin.log for errors"
fi

