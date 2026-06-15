#!/bin/bash
set -e

echo "Waiting for database to be ready..."
until pg_isready -h db -U lifeos -d org_db; do
  sleep 1
done
echo "Database is ready!"

echo "Initializing database schema and seeding data..."
bun run src/database/initialize-local-db.ts

echo "Starting SG Forge Portal Services..."

# 1. Start Dev-Dashboard (port 3002)
if [ "$NODE_ENV" = "development" ]; then
  echo "Starting Dev-Dashboard in watch mode..."
  bun --watch src/backend/dev-dashboard/server.ts &
else
  bun run src/backend/dev-dashboard/server.ts &
fi

# 2. Start Reference Expenses App (port 8085)
if [ "$NODE_ENV" = "development" ]; then
  echo "Starting Reference Expenses App in watch mode..."
  bun --watch src/apps/reference-expenses/server.ts &
else
  bun run src/apps/reference-expenses/server.ts &
fi

# 3. Start Reference Python App (port 8087)
python3 src/apps/reference-python/server.py &

# 4. Start Reference Go App (port 8086)
cd src/apps/reference-go
go run main.go &
cd /app

# 5. Start Next.js Developer Portal Proxy (port 3003)
echo "Starting Developer Portal Proxy on port 3003..."
bun run scripts/developer-proxy.ts &

# 6. Start Next.js Frontend Portal (port 3001)
if [ "$NODE_ENV" = "development" ]; then
  echo "Starting Next.js Frontend Portal on port 3001 in development mode (with hot reloading)..."
  bun run --cwd src/frontend dev -- --hostname 0.0.0.0 --port 3001
else
  echo "Starting Next.js Frontend Portal on port 3001 in production mode..."
  bun run --cwd src/frontend start -- --hostname 0.0.0.0 --port 3001
fi
