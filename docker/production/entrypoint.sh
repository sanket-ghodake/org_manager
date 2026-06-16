#!/bin/bash
set -e

# Change directory to the app root
cd /app

echo "Waiting for database to be ready..."
until pg_isready -h db -U lifeos -d org_db; do
  sleep 1
done
echo "Database is ready!"

echo "Initializing database schema and seeding data..."
bun run core/src/database/initialize-local-db.ts

echo "Starting SG Forge Portal Services in Production..."

# 1. Start Dev-Dashboard (port 3002)
bun core/src/backend/dev-dashboard/server.ts &

# 2. Start Reference Expenses App (port 8085)
bun sandbox/apps/reference-expenses/server.ts &

# 3. Start Reference Python App (port 8087)
python3 sandbox/apps/reference-python/server.py &

# 4. Start Reference Go App (port 8086) - Run pre-compiled production binary
/app/sandbox/apps/reference-go/reference-go-bin &

# 5. Start Next.js Developer Portal Proxy (port 3003)
bun run scripts/developer-proxy.ts &

# 6. Start Next.js Frontend Portal (port 3001) in production mode
bun run --cwd core/src/frontend start -- --hostname 0.0.0.0 --port 3001
