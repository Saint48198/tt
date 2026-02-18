#!/bin/bash

# Stop all servers for Trip Tracker

echo "Stopping all Trip Tracker servers..."

pkill -f "nx serve api"
pkill -f "nx serve frontend-app"
pkill -f "nx serve frontend-admin"

echo "All servers stopped."

