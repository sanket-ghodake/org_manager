#!/bin/bash
set -e

# Change directory to the app root
cd /app

echo "Checking node_modules..."
if [ ! -d "node_modules/drizzle-orm" ] || [ ! -d "core/src/frontend/node_modules/next" ]; then
  echo "Dependencies not found or incomplete. Installing packages..."
  bun install
  cd core/src/frontend && bun install
  cd /app
fi

echo "Waiting for database to be ready..."
until pg_isready -h db -U lifeos -d org_db; do
  sleep 1
done
echo "Database is ready!"

echo "Initializing database schema and seeding data..."
bun run core/src/database/initialize-local-db.ts

echo "Starting SG Forge Portal Services in Development (Hot-Reloading)..."

# 1. Start Dev-Dashboard (port 3002)
bun --watch core/src/backend/dev-dashboard/server.ts &

# 2. Start Dynamic Sandbox App Runner
bun scripts/dynamic-app-runner.ts &

# 3. Start Next.js Developer Portal Proxy (port 3003)
bun run scripts/developer-proxy.ts &

# 6. Start Next.js Frontend Portal (port 3001) in development mode
bun run --cwd core/src/frontend dev -- --hostname 0.0.0.0 --port 3001
